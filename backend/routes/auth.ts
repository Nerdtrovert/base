import express from 'express';
import bcrypt from 'bcrypt';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserById,
  logout,
  registerDeviceAndGenerateTokens,
  registerWithEmail,
  loginWithEmail,
  verifyAccessToken,
  verifyRefreshTokenInDb
} from '../services/auth.service';
import { authMiddleware, authRateLimiter } from '../middleware/auth';
import { query } from '../database/postgres';
import { decryptValue, encryptValue, exchangeCodeForGoogleTokens, fetchGoogleProfile, saveGoogleTokens } from '../services/google.service';
import { JWTPayload } from '../models/types';
import { getGoogleAuthUrlController, googleCallbackController } from '../controllers/authController';

const router = express.Router();
const PENDING_GDRIVE_SIGNUP_COOKIE = 'pendingGDriveSignup';
const PENDING_GDRIVE_MAX_AGE_MS = 10 * 60 * 1000;

const getCookieOptions = (req: any) => {
  const origin = req.headers.origin;
  const isDevTunnel = origin && origin.includes('devtunnels.ms');
  const isRender = origin && origin.includes('onrender.com');
  const isProd = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isDevTunnel || isRender || isProd,
    sameSite: (isDevTunnel || isRender) ? 'none' as const : 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };
};

const getPendingGDriveCookieOptions = (req: any) => ({
  ...getCookieOptions(req),
  maxAge: PENDING_GDRIVE_MAX_AGE_MS
});

const setPendingGDriveSignup = (req: any, res: any, payload: Record<string, unknown>) => {
  res.cookie(
    PENDING_GDRIVE_SIGNUP_COOKIE,
    encryptValue(JSON.stringify(payload)),
    getPendingGDriveCookieOptions(req)
  );
};

const clearPendingGDriveSignup = (req: any, res: any) => {
  const { maxAge, ...clearOptions } = getPendingGDriveCookieOptions(req);
  res.clearCookie(PENDING_GDRIVE_SIGNUP_COOKIE, clearOptions);
};

const readPendingGDriveSignup = (req: any) => {
  const rawValue = req.cookies?.[PENDING_GDRIVE_SIGNUP_COOKIE];
  if (!rawValue) return null;

  try {
    const decrypted = decryptValue(rawValue);
    return decrypted ? JSON.parse(decrypted) : null;
  } catch (error) {
    console.error('[Auth] Failed to parse pending Google signup cookie:', error);
    return null;
  }
};

// Register with Email
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { email, password, name, deviceInfo } = req.body;

    if (!email || !password || !name || !deviceInfo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const tokens = await registerWithEmail(email, password, name, deviceInfo);

    // Set secure cookie with refresh token
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(req));

    res.json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      deviceId: tokens.deviceId,
      expiresIn: tokens.expiresIn,
      user: {
        email,
        name,
        picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`
      }
    });
  } catch (error: any) {
    console.error('[Auth] Register error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// Register with Google Drive (email & password setup)
router.post('/register-gdrive', authRateLimiter, async (req, res) => {
  try {
    const { email, password, name, deviceInfo } = req.body;
    const pendingSignup = readPendingGDriveSignup(req);

    if (!email || !password || !name || !deviceInfo || !pendingSignup?.google_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (pendingSignup.email !== email) {
      return res.status(400).json({ error: 'Pending Google sign-up session does not match this email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert user in database
    const userResult = await query(
      `INSERT INTO users (email, google_id, password_hash, name, picture, google_access_token, google_refresh_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET
       google_id = EXCLUDED.google_id,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       picture = COALESCE(users.picture, EXCLUDED.picture),
       google_access_token = EXCLUDED.google_access_token,
       google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, users.google_refresh_token)
       RETURNING id`,
      [email, pendingSignup.google_id, passwordHash, name, pendingSignup.picture, null, null]
    );

    const userId = userResult.rows[0].id;

    await saveGoogleTokens(userId, email, {
      access_token: pendingSignup.access_token,
      refresh_token: pendingSignup.refresh_token,
      scope: pendingSignup.scope,
      expiry_date: pendingSignup.expiry_date ? Number(pendingSignup.expiry_date) : null
    });

    // Register device
    await query(
      `INSERT INTO devices (user_id, device_name, device_type, os, unique_identifier, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (user_id, unique_identifier) DO UPDATE SET
       last_seen = CURRENT_TIMESTAMP`,
      [userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]
    );

    clearPendingGDriveSignup(req, res);
    res.json({ success: true, message: 'Google Drive account connected. Registration complete.' });
  } catch (error: any) {
    console.error('[Auth] Register GDrive error:', error);
    res.status(400).json({ error: error.message || 'Registration failed' });
  }
});

// Login with Email
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;

    if (!email || !password || !deviceInfo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const tokens = await loginWithEmail(email, password, deviceInfo);

    // Get user details
    const user = await getUserById(tokens.userId);

    // Set secure cookie with refresh token
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(req));

    res.json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      deviceId: tokens.deviceId,
      expiresIn: tokens.expiresIn,
      user: user ? {
        email: user.email,
        name: user.name,
        picture: user.picture
      } : null
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    res.status(400).json({ error: error.message || 'Login failed' });
  }
});

// Get Auth Status (compatible with google/status frontend endpoint)
router.get('/google/status', async (req, res) => {
  try {
    const authHeaderToken = req.headers.authorization?.split('Bearer ')[1];
    const cookieToken = req.cookies.refreshToken;

    const token = authHeaderToken || cookieToken;

    if (!token) {
      return res.json({ isAuthenticated: false, isMock: false });
    }

    let payload: JWTPayload | null = null;
    if (authHeaderToken) {
      payload = verifyAccessToken(authHeaderToken);
    } else if (cookieToken) {
      payload = await verifyRefreshTokenInDb(cookieToken);
    }

    if (!payload) {
      return res.json({ isAuthenticated: false, isMock: false });
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      return res.json({ isAuthenticated: false, isMock: false });
    }

    res.json({
      isAuthenticated: true,
      isMock: false,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('[Auth] Status check error:', error);
    res.json({ isAuthenticated: false, isMock: false });
  }
});

// Get Google OAuth URL
router.get('/google/url', getGoogleAuthUrlController);

router.get('/google/signup-context', authRateLimiter, (req, res) => {
  const pendingSignup = readPendingGDriveSignup(req);

  if (!pendingSignup) {
    return res.status(404).json({ error: 'No pending Google sign-up session found' });
  }

  res.json({
    gdriveSignup: true,
    email: pendingSignup.email || '',
    name: pendingSignup.name || ''
  });
});

// Google OAuth callback (GET redirect from browser)
// Google OAuth callback (GET redirect from browser)
router.get('/google/callback', googleCallbackController);

// Google OAuth callback (POST request fallback/API interaction)
router.post('/google/callback', authRateLimiter, async (req, res) => {
  try {
    const { code, deviceInfo } = req.body;

    if (!code || !deviceInfo) {
      return res.status(400).json({ error: 'Missing code or device info' });
    }

    const { deviceId, name, type, os, unique_identifier } = deviceInfo;

    const tokens = await exchangeCodeForTokens(code, deviceId, {
      name,
      type,
      os,
      unique_identifier
    });

    // Set secure cookie with refresh token
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(req));

    res.json({
      accessToken: tokens.accessToken,
      userId: tokens.userId,
      deviceId: tokens.deviceId,
      expiresIn: tokens.expiresIn
    });
  } catch (error) {
    console.error('[Auth] Google callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Refresh access token
router.post('/refresh', authRateLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const result = await refreshAccessToken(refreshToken);

    res.json({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn
    });
  } catch (error) {
    console.error('[Auth] Refresh token error:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      settings: user.settings
    });
  } catch (error) {
    console.error('[Auth] Error getting profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await logout(req.deviceId!);
    const { maxAge, ...clearOptions } = getCookieOptions(req);
    res.clearCookie('refreshToken', clearOptions);
    clearPendingGDriveSignup(req, res);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Health check (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

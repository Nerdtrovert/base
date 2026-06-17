import express from 'express';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserById,
  logout,
  registerWithEmail,
  loginWithEmail,
  verifyAccessToken,
  oauth2Client
} from '../services/auth.service';
import { authMiddleware, authRateLimiter } from '../middleware/auth';
import { google } from 'googleapis';
import { query } from '../database/postgres';

const router = express.Router();

const getCookieOptions = (req: any) => {
  const origin = req.headers.origin;
  const isDevTunnel = origin && origin.includes('devtunnels.ms');
  return {
    httpOnly: true,
    secure: isDevTunnel || process.env.NODE_ENV === 'production',
    sameSite: isDevTunnel ? 'none' as const : 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };
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
    const { email, password, name, google_id, picture, access_token, refresh_token, scope, expiry_date, deviceInfo } = req.body;

    if (!email || !password || !name || !google_id || !deviceInfo) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bcrypt = require('bcrypt');
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
      [email, google_id, passwordHash, name, picture, access_token, refresh_token]
    );

    const userId = userResult.rows[0].id;

    // Save token to oauth_tokens table
    await query(
      `INSERT INTO oauth_tokens (user_id, service, scope, encrypted_token, encrypted_refresh_token, expires_at, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, email) DO UPDATE SET
       encrypted_token = EXCLUDED.encrypted_token,
       encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, oauth_tokens.encrypted_refresh_token),
       expires_at = EXCLUDED.expires_at`,
      [
        userId,
        'google',
        scope || 'https://www.googleapis.com/auth/drive.appdata',
        access_token,
        refresh_token,
        expiry_date ? new Date(parseInt(expiry_date, 10)) : null,
        email
      ]
    );

    // Register device
    await query(
      `INSERT INTO devices (user_id, device_name, device_type, os, unique_identifier, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (user_id, unique_identifier) DO UPDATE SET
       last_seen = CURRENT_TIMESTAMP`,
      [userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]
    );

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
    const token = req.cookies.refreshToken || req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.json({ isAuthenticated: false, isMock: false });
    }

    const payload = verifyAccessToken(token);
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
router.get('/google/url', (req, res) => {
  try {
    const url = generateAuthUrl();
    res.json({ url });
  } catch (error) {
    console.error('[Auth] Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Google OAuth callback (GET redirect from browser)
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (error) {
      console.error('[Auth] Google OAuth consent error:', error);
      return res.redirect(`${frontendUrl}/auth/callback?status=error&error=${encodeURIComponent(error as string)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/callback?status=error&error=No%20authorization%20code%20provided`);
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const email = userInfo.data.email;
    const name = userInfo.data.name;
    const googleId = userInfo.data.id;
    const picture = userInfo.data.picture;

    // Check if user exists in database and has a password
    const userCheck = await query(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [email]
    );

    const deviceInfo = {
      name: req.headers['user-agent']?.substring(0, 30) || 'Browser',
      type: 'web',
      os: 'unknown',
      unique_identifier: 'google-oauth-flow-' + Date.now()
    };

    if (userCheck.rows.length > 0 && userCheck.rows[0].password_hash) {
      // User exists with password. Complete login and redirect to success.
      const userId = userCheck.rows[0].id;

      // Update tokens in users table
      await query(
        `UPDATE users 
         SET google_id = $1, google_access_token = $2, google_refresh_token = COALESCE($3, google_refresh_token), picture = COALESCE(picture, $4)
         WHERE id = $5`,
        [googleId, tokens.access_token, tokens.refresh_token, picture, userId]
      );

      // Save/update to oauth_tokens table for multi-account support
      await query(
        `INSERT INTO oauth_tokens (user_id, service, scope, encrypted_token, encrypted_refresh_token, expires_at, email)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, email) DO UPDATE SET
         encrypted_token = EXCLUDED.encrypted_token,
         encrypted_refresh_token = COALESCE(EXCLUDED.encrypted_refresh_token, oauth_tokens.encrypted_refresh_token),
         expires_at = EXCLUDED.expires_at`,
        [
          userId,
          'google',
          tokens.scope || 'https://www.googleapis.com/auth/drive.appdata',
          tokens.access_token,
          tokens.refresh_token,
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          email
        ]
      );

      const { v4: uuidv4 } = require('uuid');
      const sessionTokens = await exchangeCodeForTokens(code as string, uuidv4(), deviceInfo);

      // Set secure cookie with refresh token
      res.cookie('refreshToken', sessionTokens.refreshToken, getCookieOptions(req));

      // Redirect user back to the frontend success route
      res.redirect(`${frontendUrl}/auth/callback?status=success`);
    } else {
      // New user or Google-only user with no password. Redirect to password setting flow.
      const params = new URLSearchParams({
        status: 'gdrive_signup',
        email: email || '',
        name: name || '',
        google_id: googleId || '',
        picture: picture || '',
        access_token: tokens.access_token || '',
        refresh_token: tokens.refresh_token || '',
        scope: tokens.scope || '',
        expiry_date: tokens.expiry_date ? String(tokens.expiry_date) : ''
      });
      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    }
  } catch (err) {
    console.error('[Auth] Google OAuth callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?status=error&error=Authentication%20failed`);
  }
});

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

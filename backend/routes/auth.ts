import express from 'express';
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getUserById,
  logout,
  registerWithEmail,
  loginWithEmail,
  verifyAccessToken
} from '../services/auth.service';
import { authMiddleware, authRateLimiter } from '../middleware/auth';

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

    const deviceInfo = {
      name: req.headers['user-agent']?.substring(0, 30) || 'Browser',
      type: 'web',
      os: 'unknown',
      unique_identifier: 'google-oauth-flow-' + Date.now()
    };

    // Use dynamic import for uuid or crypto to avoid require compilation issues
    const { v4: uuidv4 } = require('uuid');
    const tokens = await exchangeCodeForTokens(code as string, uuidv4(), deviceInfo);

    // Set secure cookie with refresh token
    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions(req));

    // Redirect user back to the frontend success route
    res.redirect(`${frontendUrl}/auth/callback?status=success`);
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

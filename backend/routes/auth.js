"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_service_1 = require("../services/auth.service");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get Google OAuth URL
router.get('/google/url', (req, res) => {
    try {
        const url = (0, auth_service_1.generateAuthUrl)();
        res.json({ url });
    }
    catch (error) {
        console.error('[Auth] Error generating auth URL:', error);
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});
// Google OAuth callback
router.post('/google/callback', auth_1.authRateLimiter, async (req, res) => {
    try {
        const { code, deviceInfo } = req.body;
        if (!code || !deviceInfo) {
            return res.status(400).json({ error: 'Missing code or device info' });
        }
        const { deviceId, name, type, os, unique_identifier } = deviceInfo;
        const tokens = await (0, auth_service_1.exchangeCodeForTokens)(code, deviceId, {
            name,
            type,
            os,
            unique_identifier
        });
        // Set secure cookie with refresh token
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.json({
            accessToken: tokens.accessToken,
            userId: tokens.userId,
            deviceId: tokens.deviceId,
            expiresIn: tokens.expiresIn
        });
    }
    catch (error) {
        console.error('[Auth] Google callback error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});
// Refresh access token
router.post('/refresh', auth_1.authRateLimiter, (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token provided' });
        }
        const { accessToken, expiresIn } = (0, auth_service_1.refreshAccessToken)(refreshToken);
        res.json({
            accessToken,
            expiresIn
        });
    }
    catch (error) {
        console.error('[Auth] Refresh token error:', error);
        res.status(401).json({ error: 'Failed to refresh token' });
    }
});
// Get user profile
router.get('/profile', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await (0, auth_service_1.getUserById)(req.user.userId);
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
    }
    catch (error) {
        console.error('[Auth] Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// Logout
router.post('/logout', auth_1.authMiddleware, async (req, res) => {
    try {
        await (0, auth_service_1.logout)(req.deviceId);
        res.clearCookie('refreshToken');
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
// Health check (no auth required)
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
exports.default = router;

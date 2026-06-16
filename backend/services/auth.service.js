"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.getUserById = exports.verifyAccessToken = exports.refreshAccessToken = exports.exchangeCodeForTokens = exports.generateAuthUrl = exports.oauth2Client = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const googleapis_1 = require("googleapis");
const postgres_1 = require("../database/postgres");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
// Initialize Google OAuth2 Client
exports.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
const generateAuthUrl = () => {
    const scopes = [
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];
    return exports.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });
};
exports.generateAuthUrl = generateAuthUrl;
const exchangeCodeForTokens = async (code, deviceId, deviceInfo) => {
    try {
        // Exchange code for tokens
        const { tokens } = await exports.oauth2Client.getToken(code);
        exports.oauth2Client.setCredentials(tokens);
        // Get user info
        const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: exports.oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const userData = {
            email: userInfo.data.email,
            google_id: userInfo.data.id,
            name: userInfo.data.name,
            picture: userInfo.data.picture
        };
        // Upsert user
        const userResult = await (0, postgres_1.query)(`INSERT INTO users (email, google_id, name, picture) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE SET
       name = EXCLUDED.name,
       picture = EXCLUDED.picture,
       updated_at = CURRENT_TIMESTAMP
       RETURNING id`, [userData.email, userData.google_id, userData.name, userData.picture]);
        const userId = userResult.rows[0].id;
        // Upsert device
        const deviceResult = await (0, postgres_1.query)(`INSERT INTO devices (user_id, device_name, device_type, os, unique_identifier, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (user_id, unique_identifier) DO UPDATE SET
       last_seen = CURRENT_TIMESTAMP,
       last_sync = CURRENT_TIMESTAMP
       RETURNING id`, [userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]);
        const dbDeviceId = deviceResult.rows[0].id;
        // Generate JWT and refresh token
        const accessToken = jsonwebtoken_1.default.sign({ userId, deviceId: dbDeviceId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        const refreshTokenPayload = {
            userId,
            deviceId: dbDeviceId,
            jti: (0, uuid_1.v4)() // JWT ID for token management
        };
        const refreshToken = jsonwebtoken_1.default.sign(refreshTokenPayload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
        // Store refresh token hash in database
        const tokenHash = Buffer.from(refreshToken).toString('base64');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await (0, postgres_1.query)(`INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`, [userId, dbDeviceId, tokenHash, expiresAt]);
        return {
            accessToken,
            refreshToken,
            userId,
            deviceId: dbDeviceId,
            expiresIn: 15 * 60 // 15 minutes in seconds
        };
    }
    catch (error) {
        console.error('[Auth] Error exchanging code for tokens:', error);
        throw new Error('Failed to exchange code for tokens');
    }
};
exports.exchangeCodeForTokens = exchangeCodeForTokens;
const refreshAccessToken = async (refreshToken) => {
    try {
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_SECRET);
        const { userId, deviceId } = decoded;
        // Check if refresh token exists in database
        const tokenHash = Buffer.from(refreshToken).toString('base64');
        const result = await (0, postgres_1.query)(`SELECT id FROM refresh_tokens 
       WHERE user_id = $1 AND device_id = $2 AND token_hash = $3 AND expires_at > CURRENT_TIMESTAMP`, [userId, deviceId, tokenHash]);
        if (result.rows.length === 0) {
            throw new Error('Invalid or expired refresh token');
        }
        // Generate new access token
        const accessToken = jsonwebtoken_1.default.sign({ userId, deviceId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        return {
            accessToken,
            expiresIn: 15 * 60
        };
    }
    catch (error) {
        console.error('[Auth] Error refreshing access token:', error);
        throw new Error('Failed to refresh access token');
    }
};
exports.refreshAccessToken = refreshAccessToken;
const verifyAccessToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        console.error('[Auth] Token verification failed:', error);
        return null;
    }
};
exports.verifyAccessToken = verifyAccessToken;
const getUserById = async (userId) => {
    try {
        const result = await (0, postgres_1.query)('SELECT * FROM users WHERE id = $1', [userId]);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('[Auth] Error getting user:', error);
        return null;
    }
};
exports.getUserById = getUserById;
const logout = async (deviceId) => {
    try {
        await (0, postgres_1.query)('DELETE FROM refresh_tokens WHERE device_id = $1', [deviceId]);
        return true;
    }
    catch (error) {
        console.error('[Auth] Error logging out:', error);
        return false;
    }
};
exports.logout = logout;

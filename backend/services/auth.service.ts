import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { query } from '../database/postgres';
import { User, AuthTokenResponse, JWTPayload } from '../models/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Initialize Google OAuth2 Client
export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const generateAuthUrl = (): string => {
  const scopes = [
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
};

export const exchangeCodeForTokens = async (
  code: string,
  deviceId: string,
  deviceInfo: { name: string; type: string; os: string; unique_identifier: string }
): Promise<AuthTokenResponse> => {
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const userData = {
      email: userInfo.data.email,
      google_id: userInfo.data.id,
      name: userInfo.data.name,
      picture: userInfo.data.picture
    };

    // Upsert user
    const userResult = await query(
      `INSERT INTO users (email, google_id, name, picture) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE SET
       name = EXCLUDED.name,
       picture = EXCLUDED.picture,
       updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [userData.email, userData.google_id, userData.name, userData.picture]
    );

    const userId = userResult.rows[0].id;

    // Upsert device
    const deviceResult = await query(
      `INSERT INTO devices (user_id, device_name, device_type, os, unique_identifier, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (user_id, unique_identifier) DO UPDATE SET
       last_seen = CURRENT_TIMESTAMP,
       last_sync = CURRENT_TIMESTAMP
       RETURNING id`,
      [userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]
    );

    const dbDeviceId = deviceResult.rows[0].id;

    // Generate JWT and refresh token
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRY };
    const accessToken = jwt.sign(
      { userId, deviceId: dbDeviceId },
      JWT_SECRET,
      signOptions
    );

    const refreshSignOptions: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRY };
    const refreshTokenPayload = {
      userId,
      deviceId: dbDeviceId,
      jti: uuidv4()
    };

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      JWT_SECRET,
      refreshSignOptions
    );

    // Store refresh token hash in database
    const tokenHash = Buffer.from(refreshToken).toString('base64');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, device_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, dbDeviceId, tokenHash, expiresAt]
    );

    return {
      accessToken,
      refreshToken,
      userId,
      deviceId: dbDeviceId,
      expiresIn: 15 * 60
    };
  } catch (error) {
    console.error('[Auth] Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange code for tokens');
  }
};

export const refreshAccessToken = async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload;
    const { userId, deviceId } = decoded;

    // Check if refresh token exists in database
    const tokenHash = Buffer.from(refreshToken).toString('base64');
    const result = await query(
      `SELECT id FROM refresh_tokens 
       WHERE user_id = $1 AND device_id = $2 AND token_hash = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [userId, deviceId, tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    // Generate new access token
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRY };
    const accessToken = jwt.sign(
      { userId, deviceId },
      JWT_SECRET,
      signOptions
    );

    return {
      accessToken,
      expiresIn: 15 * 60
    };
  } catch (error) {
    console.error('[Auth] Error refreshing access token:', error);
    throw new Error('Failed to refresh access token');
  }
};

export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return null;
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[Auth] Error getting user:', error);
    return null;
  }
};

export const logout = async (deviceId: string): Promise<boolean> => {
  try {
    await query('DELETE FROM refresh_tokens WHERE device_id = $1', [deviceId]);
    return true;
  } catch (error) {
    console.error('[Auth] Error logging out:', error);
    return false;
  }
};

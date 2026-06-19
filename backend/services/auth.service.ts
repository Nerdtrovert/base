import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { query } from '../database/postgres';
import { User, AuthTokenResponse, JWTPayload } from '../models/types';
import {
  exchangeCodeForGoogleTokens,
  fetchGoogleProfile,
  generateGoogleAuthUrl,
  saveGoogleTokens
} from './google.service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

export const generateAuthUrl = (): string => {
  return generateGoogleAuthUrl();
};

export const exchangeCodeForTokens = async (
  code: string,
  deviceId: string,
  deviceInfo: { name: string; type: string; os: string; unique_identifier: string }
): Promise<AuthTokenResponse> => {
  try {
    const { client, tokens } = await exchangeCodeForGoogleTokens(code);
    const profile = await fetchGoogleProfile(client);

    const userData = {
      email: profile.email,
      google_id: profile.googleId,
      name: profile.name,
      picture: profile.picture
    };

    // Upsert user with Google tokens
    const userResult = await query(
      `INSERT INTO users (email, google_id, name, picture, google_access_token, google_refresh_token) 
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (google_id) DO UPDATE SET
       name = EXCLUDED.name,
       picture = EXCLUDED.picture,
       google_access_token = EXCLUDED.google_access_token,
       google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, users.google_refresh_token),
       updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        userData.email,
        userData.google_id,
        userData.name,
        userData.picture,
        null,
        null
      ]
    );

    const userId = userResult.rows[0].id;

    await saveGoogleTokens(userId, userData.email || '', tokens);

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
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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

export const verifyRefreshTokenInDb = async (refreshToken: string): Promise<JWTPayload | null> => {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as JWTPayload;
    const { userId, deviceId } = decoded;

    const tokenHash = Buffer.from(refreshToken).toString('base64');
    const result = await query(
      `SELECT id FROM refresh_tokens 
       WHERE user_id = $1 AND device_id = $2 AND token_hash = $3 AND expires_at > CURRENT_TIMESTAMP`,
      [userId, deviceId, tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[Auth] Refresh token database verification failed:', error);
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

// Helper to register device and generate JWT + Refresh tokens
export const registerDeviceAndGenerateTokens = async (
  userId: string,
  deviceInfo: { name: string; type: string; os: string; unique_identifier: string }
): Promise<AuthTokenResponse> => {
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
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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
};

export const registerWithEmail = async (
  email: string,
  passwordStr: string,
  name: string,
  deviceInfo: { name: string; type: string; os: string; unique_identifier: string }
): Promise<AuthTokenResponse> => {
  try {
    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(passwordStr, saltRounds);

    // Default picture placeholder using UI avatar styling
    const picture = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    // Insert user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, name, picture)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [email, passwordHash, name, picture]
    );

    const userId = userResult.rows[0].id;

    // Register device and generate tokens
    return await registerDeviceAndGenerateTokens(userId, deviceInfo);
  } catch (error: any) {
    console.error('[Auth] Error registering with email:', error);
    throw new Error(error.message || 'Registration failed');
  }
};

export const loginWithEmail = async (
  email: string,
  passwordStr: string,
  deviceInfo: { name: string; type: string; os: string; unique_identifier: string }
): Promise<AuthTokenResponse> => {
  try {
    // Get user
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = userResult.rows[0];

    // Check if password login is supported for this user (they might have registered via Google only)
    if (!user.password_hash) {
      throw new Error('This account uses Google Sign-In. Please connect using Google.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(passwordStr, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Register device and generate tokens
    return await registerDeviceAndGenerateTokens(user.id, deviceInfo);
  } catch (error: any) {
    console.error('[Auth] Error logging in with email:', error);
    throw new Error(error.message || 'Login failed');
  }
};

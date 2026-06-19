import crypto from 'crypto';
import { google } from 'googleapis';
import { query } from '../database/postgres';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

const GOOGLE_TOKEN_PREFIX = 'enc:v1:';
const DEFAULT_ENCRYPTION_KEY = 'base-dev-google-token-key-change-me-32';
const encryptionKeyMaterial =
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
  process.env.APP_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  DEFAULT_ENCRYPTION_KEY;

const encryptionKey = crypto.createHash('sha256').update(encryptionKeyMaterial).digest();

export interface GoogleTokenRecord {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  email: string | null;
}

export interface GoogleProfile {
  email: string;
  googleId: string;
  name: string;
  picture: string;
}

export interface GoogleTokenSet {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  expiry_date?: number | null;
}

export const isMockGoogleConfigured = (): boolean =>
  process.env.GOOGLE_CLIENT_ID === 'MOCK_CLIENT_ID' || !process.env.GOOGLE_CLIENT_ID;

export const createGoogleOAuthClient = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

export const generateGoogleAuthUrl = (): string =>
  createGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SCOPES,
    prompt: 'consent'
  });

export const encryptValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (value.startsWith(GOOGLE_TOKEN_PREFIX)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${GOOGLE_TOKEN_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
};

export const decryptValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith(GOOGLE_TOKEN_PREFIX)) return value;

  const payload = Buffer.from(value.slice(GOOGLE_TOKEN_PREFIX.length), 'base64');
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

export const exchangeCodeForGoogleTokens = async (code: string) => {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return { client, tokens };
};

export const fetchGoogleProfile = async (client: ReturnType<typeof createGoogleOAuthClient>): Promise<GoogleProfile> => {
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();

  return {
    email: userInfo.data.email || '',
    googleId: userInfo.data.id || '',
    name: userInfo.data.name || '',
    picture: userInfo.data.picture || ''
  };
};

export const saveGoogleTokens = async (
  userId: string,
  email: string,
  tokens: GoogleTokenSet
): Promise<void> => {
  const encryptedAccessToken = encryptValue(tokens.access_token);
  const encryptedRefreshToken = encryptValue(tokens.refresh_token);
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

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
      tokens.scope || GOOGLE_SCOPES[0],
      encryptedAccessToken,
      encryptedRefreshToken,
      expiresAt,
      email
    ]
  );

  await query(
    `UPDATE users
     SET google_access_token = $1,
         google_refresh_token = COALESCE($2, google_refresh_token),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [encryptedAccessToken, encryptedRefreshToken, userId]
  );
};

export const getGoogleTokensForUser = async (
  userId: string,
  email?: string
): Promise<GoogleTokenRecord> => {
  if (email) {
    const tokenResult = await query(
      `SELECT encrypted_token, encrypted_refresh_token, expires_at, email
       FROM oauth_tokens
       WHERE user_id = $1 AND email = $2 AND service = 'google'`,
      [userId, email]
    );

    if (tokenResult.rows.length > 0) {
      const row = tokenResult.rows[0];
      return {
        accessToken: decryptValue(row.encrypted_token),
        refreshToken: decryptValue(row.encrypted_refresh_token),
        expiresAt: row.expires_at || null,
        email: row.email || email
      };
    }
  }

  const userResult = await query(
    `SELECT email, google_access_token, google_refresh_token
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      email: email || null
    };
  }

  const row = userResult.rows[0];
  return {
    accessToken: decryptValue(row.google_access_token),
    refreshToken: decryptValue(row.google_refresh_token),
    expiresAt: null,
    email: email || row.email || null
  };
};

export const attachGoogleTokenPersistence = (
  client: ReturnType<typeof createGoogleOAuthClient>,
  userId: string,
  email: string
) => {
  client.on('tokens', async (newTokens) => {
    if (!newTokens.access_token && !newTokens.refresh_token) {
      return;
    }

    await saveGoogleTokens(userId, email, {
      access_token: newTokens.access_token || undefined,
      refresh_token: newTokens.refresh_token || undefined,
      expiry_date: newTokens.expiry_date || undefined
    });
  });
};

export const createGoogleDriveClientForUser = async (userId: string, email?: string) => {
  const tokenRecord = await getGoogleTokensForUser(userId, email);

  if (!tokenRecord.accessToken && !tokenRecord.refreshToken) {
    return null;
  }

  const client = createGoogleOAuthClient();
  client.setCredentials({
    access_token: tokenRecord.accessToken || undefined,
    refresh_token: tokenRecord.refreshToken || undefined
  });

  if (tokenRecord.email) {
    attachGoogleTokenPersistence(client, userId, tokenRecord.email);
  }

  return {
    client,
    drive: google.drive({ version: 'v3', auth: client }),
    email: tokenRecord.email
  };
};

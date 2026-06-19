import { google } from 'googleapis';
import { encryptToken } from '../utils/tokenEncryption';

const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.file'
];

export interface GoogleProfile {
  email: string;
  googleId: string;
  name: string;
  picture: string;
}

export interface GoogleTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  expiry_date?: number | null;
}

/**
 * Creates a new Google OAuth2 client instances
 */
export const createOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

/**
 * Generates the Google OAuth authorization URL
 */
export const generateGoogleAuthUrl = (): string => {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: GOOGLE_SCOPES
  });
};

/**
 * Exchanges auth code for access/refresh tokens
 */
export const exchangeCodeForTokens = async (code: string): Promise<{ client: any; tokens: GoogleTokens }> => {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  return { client, tokens };
};

/**
 * Fetches user profile from Google OAuth client
 */
export const fetchGoogleProfile = async (client: any): Promise<GoogleProfile> => {
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const userInfo = await oauth2.userinfo.get();

  return {
    email: userInfo.data.email || '',
    googleId: userInfo.data.id || '',
    name: userInfo.data.name || '',
    picture: userInfo.data.picture || ''
  };
};

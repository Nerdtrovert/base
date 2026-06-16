import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { google } from 'googleapis';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Initialize Google OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || 'MOCK_CLIENT_ID',
  process.env.GOOGLE_CLIENT_SECRET || 'MOCK_CLIENT_SECRET',
  process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/auth/google/callback`
);

// Check if credentials are properly configured
const isGoogleConfigured = () => {
  return (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'MOCK_CLIENT_ID'
  );
};

// ----------------------------------------------------
// Google OAuth Endpoints
// ----------------------------------------------------

// Generate Authorization URL
app.get('/api/auth/google/url', (req, res) => {
  if (!isGoogleConfigured()) {
    console.log('[Auth] Google OAuth not fully configured. Returning mock login URL.');
    return res.json({
      url: `${FRONTEND_URL}/auth/callback?mock=true&code=mock_code_12345`,
      isMock: true
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/drive.appdata', // Access to app data folder only
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ url, isMock: false });
});

// OAuth Callback handler
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, mock } = req.query;

  if (mock === 'true' || !isGoogleConfigured()) {
    console.log('[Auth] Successful mock login callback.');
    // Set a mock token cookie
    res.cookie('auth_token', 'mock_token_xyz_98765', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    return res.redirect(`${FRONTEND_URL}/auth/callback?status=success&user=MockStudent`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/auth/callback?status=error&error=no_code_provided`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Save tokens in HTTP-only secure cookie or database
    res.cookie('auth_token', JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${FRONTEND_URL}/auth/callback?status=success`);
  } catch (error) {
    console.error('[Auth] Error exchanging code for tokens:', error);
    res.redirect(`${FRONTEND_URL}/auth/callback?status=error&error=token_exchange_failed`);
  }
});

// Get Auth status and user profile
app.get('/api/auth/google/status', async (req, res) => {
  const tokenCookie = req.cookies.auth_token;

  if (!tokenCookie) {
    return res.json({ isAuthenticated: false });
  }

  if (tokenCookie === 'mock_token_xyz_98765' || !isGoogleConfigured()) {
    return res.json({
      isAuthenticated: true,
      isMock: true,
      user: {
        name: 'Mock Student',
        email: 'student@base.workspace',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop'
      }
    });
  }

  try {
    const tokens = JSON.parse(tokenCookie);
    const client = new google.auth.OAuth2();
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();

    res.json({
      isAuthenticated: true,
      isMock: false,
      user: {
        name: userInfo.data.name,
        email: userInfo.data.email,
        picture: userInfo.data.picture
      }
    });
  } catch (error) {
    console.error('[Auth] Error getting user info:', error);
    res.clearCookie('auth_token');
    res.json({ isAuthenticated: false });
  }
});

// Logout
app.post('/api/auth/google/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ----------------------------------------------------
// Sync Endpoints (Drive App Data Sync)
// ----------------------------------------------------

// Mock database in memory for testing local cloud backup when Google OAuth is not configured
let mockDriveStorage: { [key: string]: string } = {};

// Sync and upload local state to Google Drive App Folder
app.post('/api/sync/upload', async (req, res) => {
  const tokenCookie = req.cookies.auth_token;
  const { data, timestamp } = req.body;

  if (!tokenCookie) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (tokenCookie === 'mock_token_xyz_98765' || !isGoogleConfigured()) {
    console.log('[Sync] Saving to mock cloud storage (In-Memory).');
    mockDriveStorage['base_backup'] = JSON.stringify({ data, timestamp });
    return res.json({ success: true, message: 'Saved to mock cloud storage', timestamp });
  }

  try {
    const tokens = JSON.parse(tokenCookie);
    const client = new google.auth.OAuth2();
    client.setCredentials(tokens);

    const drive = google.drive({ version: 'v3', auth: client });

    // Look for existing backup file in the appDataFolder
    const fileList = await drive.files.list({
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
      pageSize: 1
    });

    const file = fileList.data.files?.[0];
    const fileMetadata = {
      name: 'base_workspace_backup.json',
      parents: ['appDataFolder']
    };
    const media = {
      mimeType: 'application/json',
      body: JSON.stringify({ data, timestamp })
    };

    if (file?.id) {
      // Update existing file
      await drive.files.update({
        fileId: file.id,
        media: media
      });
      console.log('[Sync] Updated existing backup file on Google Drive.');
    } else {
      // Create new file
      await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id'
      });
      console.log('[Sync] Created new backup file on Google Drive.');
    }

    res.json({ success: true, timestamp });
  } catch (error) {
    console.error('[Sync] Error backing up to Google Drive:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Download state from Google Drive App Folder
app.get('/api/sync/download', async (req, res) => {
  const tokenCookie = req.cookies.auth_token;

  if (!tokenCookie) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (tokenCookie === 'mock_token_xyz_98765' || !isGoogleConfigured()) {
    console.log('[Sync] Reading from mock cloud storage.');
    const mockBackup = mockDriveStorage['base_backup'];
    if (!mockBackup) {
      return res.json({ data: null, timestamp: 0, message: 'No backup found' });
    }
    return res.json(JSON.parse(mockBackup));
  }

  try {
    const tokens = JSON.parse(tokenCookie);
    const client = new google.auth.OAuth2();
    client.setCredentials(tokens);

    const drive = google.drive({ version: 'v3', auth: client });

    const fileList = await drive.files.list({
      spaces: 'appDataFolder',
      fields: 'files(id, name)',
      pageSize: 1
    });

    const file = fileList.data.files?.[0];

    if (!file?.id) {
      return res.json({ data: null, timestamp: 0, message: 'No backup found on Google Drive' });
    }

    const fileContent = await drive.files.get({
      fileId: file.id,
      alt: 'media'
    });

    res.json(fileContent.data);
  } catch (error) {
    console.error('[Sync] Error downloading from Google Drive:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`[Base Backend] running at http://localhost:${PORT}`);
});

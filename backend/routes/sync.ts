import express from 'express';
import { authMiddleware, syncRateLimiter } from '../middleware/auth';
import {
  processSyncEvent,
  pullSyncChanges,
  getSyncStatus,
  initializeDeviceSyncPointer,
  uploadBackup,
  restoreBackup
} from '../services/sync.service';
import {
  updateDeviceLastSeen,
  updateDeviceSyncVersion
} from '../services/device.service';
import { createGoogleDriveClientForUser, isMockGoogleConfigured } from '../services/google.service';
import { query } from '../database/postgres';

const router = express.Router();

// Initialize device sync
router.post('/init', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Missing deviceId' });
    }

    await initializeDeviceSyncPointer(deviceId);

    res.json({ success: true, message: 'Sync initialized' });
  } catch (error) {
    console.error('[Sync] Error initializing sync:', error);
    res.status(500).json({ error: 'Failed to initialize sync' });
  }
});

// Push sync events
router.post('/events', authMiddleware, syncRateLimiter, async (req, res) => {
  try {
    const { deviceId, syncVersion, events } = req.body;
    const userId = req.user!.userId;

    if (!deviceId || syncVersion === undefined || !events) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate payload size (max 1MB)
    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > 1024 * 1024) {
      return res.status(413).json({ error: 'Payload too large' });
    }

    // Validate event count (max 1000 per batch)
    if (events.length > 1000) {
      return res.status(400).json({ error: 'Too many events in batch' });
    }

    // Update device last seen
    await updateDeviceLastSeen(deviceId);

    // Process sync events
    const response = await processSyncEvent(userId, {
      deviceId,
      syncVersion,
      events
    });

    // Update device sync version
    await updateDeviceSyncVersion(deviceId, response.newSyncVersion);

    // Emit webhook to other devices (placeholder)
    // In production, emit to Google Cloud Pub/Sub here

    res.json(response);
  } catch (error) {
    console.error('[Sync] Error processing sync events:', error);
    res.status(500).json({ error: 'Failed to process sync events' });
  }
});

// Pull sync changes
router.post('/pull', authMiddleware, syncRateLimiter, async (req, res) => {
  try {
    const { deviceId, fromSyncVersion } = req.body;
    const userId = req.user!.userId;

    if (!deviceId || fromSyncVersion === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await pullSyncChanges(userId, deviceId, fromSyncVersion);

    // Update device last seen
    await updateDeviceLastSeen(deviceId);

    res.json(response);
  } catch (error) {
    console.error('[Sync] Error pulling sync changes:', error);
    res.status(500).json({ error: 'Failed to pull sync changes' });
  }
});

// Get sync status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const status = await getSyncStatus(userId);

    res.json(status);
  } catch (error) {
    console.error('[Sync] Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Webhook endpoint (for Google Pub/Sub)
router.post('/webhook', async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    console.log('[Sync] Received webhook:', data);

    // Broadcast to connected devices (placeholder)
    // In production, this would trigger real-time updates to devices

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Sync] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Upload backup endpoint with multi-account support
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { data, email } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Missing data payload' });
    }

    await uploadBackup(userId, data, email);

    res.json({ success: true, message: 'Backup uploaded successfully' });
  } catch (error) {
    console.error('[Sync] Error uploading backup:', error);
    res.status(500).json({ error: 'Failed to upload backup' });
  }
});

// Google Drive Restore Backup endpoint
router.post('/drive/restore', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { email } = req.body;

    const backup = await restoreBackup(userId, email);
    if (!backup) {
      return res.status(404).json({ error: 'No backup file found in Google Drive appDataFolder.' });
    }

    res.json({ success: true, backup });
  } catch (error: any) {
    console.error('[Sync] Restore backup error:', error);
    res.status(500).json({ error: error.message || 'Failed to restore backup' });
  }
});

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Google Drive Search
router.get('/drive/search', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { query: searchQuery, email } = req.query;
    const qStr = (searchQuery as string || '').toLowerCase();
    
    const isMock = isMockGoogleConfigured();
    
    if (isMock) {
      const mockFiles = [
        { id: 'g1', name: 'Calculus Lecture 1.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/mock1', size: '1.2 MB', account: email || 'tester@base.com' },
        { id: 'g2', name: 'Design Assets Checklist.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', webViewLink: 'https://drive.google.com/file/d/mock2', size: '420 KB', account: email || 'tester@base.com' },
        { id: 'g3', name: 'Semester Project Rubric.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/mock3', size: '840 KB', account: email || 'tester@base.com' },
        { id: 'g4', name: 'Research Paper Draft.gdoc', mimeType: 'application/vnd.google-apps.document', webViewLink: 'https://docs.google.com/document/d/mock4', size: '0 KB', account: email || 'tester@base.com' },
        { id: 'g5', name: 'Algorithm Study Guide.pdf', mimeType: 'application/pdf', webViewLink: 'https://drive.google.com/file/d/mock5', size: '2.5 MB', account: email || 'tester@base.com' }
      ];
      
      const filtered = mockFiles.filter(f => f.name.toLowerCase().includes(qStr));
      return res.json({ files: filtered });
    }
    
    const driveContext = await createGoogleDriveClientForUser(userId, email as string);
    if (!driveContext) {
      return res.json({ files: [] });
    }
    
    const { drive } = driveContext;
    const escapedQuery = qStr.replace(/'/g, "\\'");
    // Search for non-folders that are not trashed and match name query
    const driveQuery = `name contains '${escapedQuery}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
    
    const response = await drive.files.list({
      q: driveQuery,
      fields: 'files(id, name, mimeType, webViewLink, size)',
      pageSize: 30
    });
    
    const files = (response.data.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      size: file.size ? formatBytes(parseInt(file.size)) : '0 Bytes',
      account: email || driveContext.email || 'user'
    }));
    
    return res.json({ files });
  } catch (error) {
    console.error('[Drive Search] Error:', error);
    res.status(500).json({ error: 'Failed to search Google Drive' });
  }
});

// Google Drive Folder List
router.get('/drive/folders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { email } = req.query;
    const isMock = isMockGoogleConfigured();
    
    if (isMock) {
      const mockFolders = [
        { id: 'f_root', name: 'My Drive (Root)', path: '/' },
        { id: 'f1', name: 'Lectures', path: '/Lectures' },
        { id: 'f2', name: 'Assignments', path: '/Assignments' },
        { id: 'f3', name: 'Personal Study', path: '/Personal Study' }
      ];
      return res.json({ folders: mockFolders });
    }
    
    const driveContext = await createGoogleDriveClientForUser(userId, email as string);
    if (!driveContext) {
      return res.json({ folders: [] });
    }
    
    const { drive } = driveContext;
    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      pageSize: 50
    });
    
    const folders = [
      { id: 'f_root', name: 'My Drive (Root)', path: '/' },
      ...(response.data.files || []).map((f) => ({
        id: f.id,
        name: f.name || '',
        path: `/${f.name}`
      }))
    ];
    
    return res.json({ folders });
  } catch (error) {
    console.error('[Drive Folders] Error:', error);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Google Drive Connected Accounts List
router.get('/drive/accounts', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const isMock = isMockGoogleConfigured();
    
    if (isMock) {
      // Return a default mock account list if in mock mode
      return res.json({
        accounts: [
          { email: 'tester@base.com', isActive: true, connectedAt: Date.now() - 86400000 * 2, fileCount: 24 }
        ]
      });
    }

    const tokenResult = await query(
      `SELECT email, created_at
       FROM oauth_tokens
       WHERE user_id = $1 AND service = 'google'
       ORDER BY created_at DESC`,
      [userId]
    );

    const accounts = tokenResult.rows.map((row: any) => ({
      email: row.email,
      isActive: true,
      connectedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      fileCount: 24
    }));

    return res.json({ accounts });
  } catch (error) {
    console.error('[Drive Accounts] Error:', error);
    res.status(500).json({ error: 'Failed to fetch connected accounts' });
  }
});

// Google Drive File Upload (supports base64 binary uploads and folder destinations)
router.post('/drive/upload', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { email, fileName, folderId, content, mimeType } = req.body;

    if (!email || !fileName || !content) {
      return res.status(400).json({ error: 'Missing email, fileName, or content' });
    }

    const isMock = isMockGoogleConfigured();
    
    if (isMock) {
      await new Promise(r => setTimeout(r, 800));
      return res.json({
        success: true,
        fileId: `g_new_${Date.now()}`,
        webViewLink: `https://drive.google.com/file/d/mock_new_${Date.now()}`,
        message: 'File successfully uploaded to Google Drive folder (Mock).'
      });
    }

    const driveContext = await createGoogleDriveClientForUser(userId, email);

    if (!driveContext) {
      return res.status(401).json({ error: 'Google account not connected or unauthorized' });
    }
    const { drive } = driveContext;

    // 1. Decode base64 file content
    const fileBuffer = Buffer.from(content, 'base64');
    const { Readable } = require('stream');
    const media = {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from(fileBuffer)
    };

    // 2. Determine parent folders
    const parents = folderId && folderId !== 'f_root' ? [folderId] : [];

    // 3. Upload to Google Drive
    const uploadRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: parents.length > 0 ? parents : undefined
      },
      media,
      fields: 'id, webViewLink'
    });

    return res.json({
      success: true,
      fileId: uploadRes.data.id,
      webViewLink: uploadRes.data.webViewLink,
      message: 'File successfully uploaded to Google Drive folder.'
    });

  } catch (error) {
    console.error('[Drive Upload] Error:', error);
    res.status(500).json({ error: 'Failed to upload to Google Drive' });
  }
});

export default router;

import express from 'express';
import { authMiddleware, syncRateLimiter } from '../middleware/auth';
import {
  processSyncEvent,
  pullSyncChanges,
  getSyncStatus,
  initializeDeviceSyncPointer
} from '../services/sync.service';
import {
  updateDeviceLastSeen,
  updateDeviceSyncVersion
} from '../services/device.service';

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
    const response = await processSyncEvent({
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

export default router;

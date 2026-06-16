"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const sync_service_1 = require("../services/sync.service");
const device_service_1 = require("../services/device.service");
const router = express_1.default.Router();
// Initialize device sync
router.post('/init', auth_1.authMiddleware, async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) {
            return res.status(400).json({ error: 'Missing deviceId' });
        }
        await (0, sync_service_1.initializeDeviceSyncPointer)(deviceId);
        res.json({ success: true, message: 'Sync initialized' });
    }
    catch (error) {
        console.error('[Sync] Error initializing sync:', error);
        res.status(500).json({ error: 'Failed to initialize sync' });
    }
});
// Push sync events
router.post('/events', auth_1.authMiddleware, auth_1.syncRateLimiter, async (req, res) => {
    try {
        const { deviceId, syncVersion, events } = req.body;
        const userId = req.user.userId;
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
        await (0, device_service_1.updateDeviceLastSeen)(deviceId);
        // Process sync events
        const response = await (0, sync_service_1.processSyncEvent)({
            deviceId,
            syncVersion,
            events
        });
        // Update device sync version
        await (0, device_service_1.updateDeviceSyncVersion)(deviceId, response.newSyncVersion);
        // Emit webhook to other devices (placeholder)
        // In production, emit to Google Cloud Pub/Sub here
        res.json(response);
    }
    catch (error) {
        console.error('[Sync] Error processing sync events:', error);
        res.status(500).json({ error: 'Failed to process sync events' });
    }
});
// Pull sync changes
router.post('/pull', auth_1.authMiddleware, auth_1.syncRateLimiter, async (req, res) => {
    try {
        const { deviceId, fromSyncVersion } = req.body;
        const userId = req.user.userId;
        if (!deviceId || fromSyncVersion === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const response = await (0, sync_service_1.pullSyncChanges)(userId, deviceId, fromSyncVersion);
        // Update device last seen
        await (0, device_service_1.updateDeviceLastSeen)(deviceId);
        res.json(response);
    }
    catch (error) {
        console.error('[Sync] Error pulling sync changes:', error);
        res.status(500).json({ error: 'Failed to pull sync changes' });
    }
});
// Get sync status
router.get('/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const status = await (0, sync_service_1.getSyncStatus)(userId);
        res.json(status);
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('[Sync] Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
exports.default = router;

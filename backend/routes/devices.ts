import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  listUserDevices,
  deleteDevice,
  getActiveDeviceCount
} from '../services/device.service';

const router = express.Router();

// List all user devices
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const devices = await listUserDevices(userId);

    res.json({ devices });
  } catch (error) {
    console.error('[Devices] Error listing devices:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// Get device count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const count = await getActiveDeviceCount(userId);

    res.json({ activeDevices: count });
  } catch (error) {
    console.error('[Devices] Error getting device count:', error);
    res.status(500).json({ error: 'Failed to get device count' });
  }
});

// Delete a device
router.delete('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { deviceId } = req.params;

    if (typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'Invalid deviceId' });
    }

    const success = await deleteDevice(userId, deviceId);

    if (!success) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device deleted' });
  } catch (error) {
    console.error('[Devices] Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const device_service_1 = require("../services/device.service");
const router = express_1.default.Router();
// List all user devices
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const devices = await (0, device_service_1.listUserDevices)(userId);
        res.json({ devices });
    }
    catch (error) {
        console.error('[Devices] Error listing devices:', error);
        res.status(500).json({ error: 'Failed to list devices' });
    }
});
// Get device count
router.get('/count', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const count = await (0, device_service_1.getActiveDeviceCount)(userId);
        res.json({ activeDevices: count });
    }
    catch (error) {
        console.error('[Devices] Error getting device count:', error);
        res.status(500).json({ error: 'Failed to get device count' });
    }
});
// Delete a device
router.delete('/:deviceId', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { deviceId } = req.params;
        const success = await (0, device_service_1.deleteDevice)(userId, deviceId);
        if (!success) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ success: true, message: 'Device deleted' });
    }
    catch (error) {
        console.error('[Devices] Error deleting device:', error);
        res.status(500).json({ error: 'Failed to delete device' });
    }
});
exports.default = router;

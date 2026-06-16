"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveDeviceCount = exports.cleanupInactiveDevices = exports.registerDevice = exports.deleteDevice = exports.updateDeviceSyncVersion = exports.updateDeviceLastSeen = exports.getDeviceById = exports.listUserDevices = void 0;
const uuid_1 = require("uuid");
const postgres_1 = require("../database/postgres");
const listUserDevices = async (userId) => {
    try {
        const result = await (0, postgres_1.query)(`SELECT id, device_name, device_type, last_seen, last_sync, sync_version
       FROM devices 
       WHERE user_id = $1
       ORDER BY last_seen DESC`, [userId]);
        return result.rows;
    }
    catch (error) {
        console.error('[Devices] Error listing devices:', error);
        throw error;
    }
};
exports.listUserDevices = listUserDevices;
const getDeviceById = async (deviceId) => {
    try {
        const result = await (0, postgres_1.query)('SELECT * FROM devices WHERE id = $1', [deviceId]);
        return result.rows[0] || null;
    }
    catch (error) {
        console.error('[Devices] Error getting device:', error);
        return null;
    }
};
exports.getDeviceById = getDeviceById;
const updateDeviceLastSeen = async (deviceId) => {
    try {
        await (0, postgres_1.query)(`UPDATE devices 
       SET last_seen = CURRENT_TIMESTAMP
       WHERE id = $1`, [deviceId]);
    }
    catch (error) {
        console.error('[Devices] Error updating device last seen:', error);
        throw error;
    }
};
exports.updateDeviceLastSeen = updateDeviceLastSeen;
const updateDeviceSyncVersion = async (deviceId, syncVersion) => {
    try {
        await (0, postgres_1.query)(`UPDATE devices 
       SET sync_version = $1, last_sync = CURRENT_TIMESTAMP
       WHERE id = $2`, [syncVersion, deviceId]);
    }
    catch (error) {
        console.error('[Devices] Error updating device sync version:', error);
        throw error;
    }
};
exports.updateDeviceSyncVersion = updateDeviceSyncVersion;
const deleteDevice = async (userId, deviceId) => {
    try {
        // Ensure device belongs to user
        const result = await (0, postgres_1.query)('DELETE FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
        return result.rowCount > 0;
    }
    catch (error) {
        console.error('[Devices] Error deleting device:', error);
        throw error;
    }
};
exports.deleteDevice = deleteDevice;
const registerDevice = async (userId, deviceInfo) => {
    try {
        const deviceId = (0, uuid_1.v4)();
        const result = await (0, postgres_1.query)(`INSERT INTO devices (id, user_id, device_name, device_type, os, unique_identifier, last_seen, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
       RETURNING *`, [deviceId, userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]);
        return result.rows[0];
    }
    catch (error) {
        console.error('[Devices] Error registering device:', error);
        throw error;
    }
};
exports.registerDevice = registerDevice;
const cleanupInactiveDevices = async (userId, inactiveThresholdDays = 30) => {
    try {
        const result = await (0, postgres_1.query)(`DELETE FROM devices 
       WHERE user_id = $1 AND last_seen < CURRENT_TIMESTAMP - INTERVAL '${inactiveThresholdDays} days'`, [userId]);
        return result.rowCount || 0;
    }
    catch (error) {
        console.error('[Devices] Error cleaning up inactive devices:', error);
        throw error;
    }
};
exports.cleanupInactiveDevices = cleanupInactiveDevices;
const getActiveDeviceCount = async (userId) => {
    try {
        const result = await (0, postgres_1.query)(`SELECT COUNT(*) as count FROM devices 
       WHERE user_id = $1 AND last_seen > CURRENT_TIMESTAMP - INTERVAL '7 days'`, [userId]);
        return parseInt(result.rows[0].count, 10);
    }
    catch (error) {
        console.error('[Devices] Error getting active device count:', error);
        throw error;
    }
};
exports.getActiveDeviceCount = getActiveDeviceCount;

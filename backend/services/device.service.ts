import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/postgres';
import { Device } from '../models/types';

export const listUserDevices = async (userId: string): Promise<Device[]> => {
  try {
    const result = await query(
      `SELECT id, device_name, device_type, last_seen, last_sync, sync_version
       FROM devices 
       WHERE user_id = $1
       ORDER BY last_seen DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('[Devices] Error listing devices:', error);
    throw error;
  }
};

export const getDeviceById = async (deviceId: string): Promise<Device | null> => {
  try {
    const result = await query(
      'SELECT * FROM devices WHERE id = $1',
      [deviceId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('[Devices] Error getting device:', error);
    return null;
  }
};

export const updateDeviceLastSeen = async (deviceId: string): Promise<void> => {
  try {
    await query(
      `UPDATE devices 
       SET last_seen = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [deviceId]
    );
  } catch (error) {
    console.error('[Devices] Error updating device last seen:', error);
    throw error;
  }
};

export const updateDeviceSyncVersion = async (deviceId: string, syncVersion: number): Promise<void> => {
  try {
    await query(
      `UPDATE devices 
       SET sync_version = $1, last_sync = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [syncVersion, deviceId]
    );
  } catch (error) {
    console.error('[Devices] Error updating device sync version:', error);
    throw error;
  }
};

export const deleteDevice = async (userId: string, deviceId: string): Promise<boolean> => {
  try {
    // Ensure device belongs to user
    const result = await query(
      'DELETE FROM devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    return result.rowCount > 0;
  } catch (error) {
    console.error('[Devices] Error deleting device:', error);
    throw error;
  }
};

export const registerDevice = async (userId: string, deviceInfo: {
  name: string;
  type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  unique_identifier: string;
}): Promise<Device> => {
  try {
    const deviceId = uuidv4();

    const result = await query(
      `INSERT INTO devices (id, user_id, device_name, device_type, os, unique_identifier, last_seen, last_sync, sync_version)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
       RETURNING *`,
      [deviceId, userId, deviceInfo.name, deviceInfo.type, deviceInfo.os, deviceInfo.unique_identifier]
    );

    return result.rows[0];
  } catch (error) {
    console.error('[Devices] Error registering device:', error);
    throw error;
  }
};

export const cleanupInactiveDevices = async (userId: string, inactiveThresholdDays: number = 30): Promise<number> => {
  try {
    const result = await query(
      `DELETE FROM devices 
       WHERE user_id = $1 AND last_seen < CURRENT_TIMESTAMP - INTERVAL '${inactiveThresholdDays} days'`,
      [userId]
    );

    return result.rowCount || 0;
  } catch (error) {
    console.error('[Devices] Error cleaning up inactive devices:', error);
    throw error;
  }
};

export const getActiveDeviceCount = async (userId: string): Promise<number> => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM devices 
       WHERE user_id = $1 AND last_seen > CURRENT_TIMESTAMP - INTERVAL '7 days'`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('[Devices] Error getting active device count:', error);
    throw error;
  }
};

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import zlib from 'zlib';
import { Readable } from 'stream';
import { query } from '../database/postgres';
import { SyncRequest, SyncResponse, SyncPullResponse, SyncEvent } from '../models/types';
import { getStorageProvider } from './storage.service';

let globalSyncVersion = 0;

export const processSyncEvent = async (syncRequest: SyncRequest): Promise<SyncResponse> => {
  try {
    const { deviceId, syncVersion, events } = syncRequest;

    // Update device sync pointer
    await query(
      `UPDATE device_sync_pointers 
       SET global_sync_version = $1, last_sync_time = CURRENT_TIMESTAMP
       WHERE device_id = $2`,
      [globalSyncVersion, deviceId]
    );

    // Insert sync events
    const conflicts = [];
    for (const event of events) {
      const eventId = uuidv4();
      
      // Check for conflicts using content hash
      const existingEvent = await query(
        `SELECT * FROM sync_events 
         WHERE content_id = $1 AND content_hash != $2
         ORDER BY timestamp DESC LIMIT 1`,
        [event.id, event.hash]
      );

      if (existingEvent.rows.length > 0) {
        const conflict = existingEvent.rows[0];
        conflicts.push({
          localId: event.id,
          remoteId: conflict.id,
          resolution: 'keep_latest'
        });

        // Log conflict
        await query(
          `INSERT INTO sync_conflicts (user_id, content_id, device_1_id, device_2_id, device_1_version, device_2_version, resolution)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            conflict.user_id,
            event.id,
            deviceId,
            conflict.device_id,
            syncVersion,
            conflict.created_at,
            'keep_latest'
          ]
        );
      }

      // Insert event
      await query(
        `INSERT INTO sync_events (id, user_id, device_id, event_type, content_id, content_hash, payload, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          'user_id_placeholder', // Will be set by auth middleware
          deviceId,
          event.type,
          event.id,
          event.hash,
          JSON.stringify(event.data || {}),
          new Date(event.timestamp)
        ]
      );
    }

    globalSyncVersion++;

    return {
      acknowledged: true,
      newSyncVersion: globalSyncVersion,
      conflicts
    };
  } catch (error) {
    console.error('[Sync] Error processing sync event:', error);
    throw error;
  }
};

export const pullSyncChanges = async (userId: string, deviceId: string, fromSyncVersion: number): Promise<SyncPullResponse> => {
  try {
    // Get all sync events since last sync for this user
    const eventsResult = await query(
      `SELECT * FROM sync_events 
       WHERE user_id = $1 
       ORDER BY timestamp ASC`,
      [userId]
    );

    // Get device states
    const devicesResult = await query(
      `SELECT id, sync_version, last_sync FROM devices 
       WHERE user_id = $1`,
      [userId]
    );

    const events: SyncEvent[] = eventsResult.rows;
    const deviceStates = devicesResult.rows.map((device: any) => ({
      deviceId: device.id,
      lastSyncVersion: device.sync_version,
      lastSeen: device.last_sync
    }));

    return {
      events,
      currentSyncVersion: globalSyncVersion,
      deviceStates
    };
  } catch (error) {
    console.error('[Sync] Error pulling sync changes:', error);
    throw error;
  }
};

export const getSyncStatus = async (userId: string) => {
  try {
    const devicesResult = await query(
      `SELECT * FROM device_sync_pointers dsp
       JOIN devices d ON dsp.device_id = d.id
       WHERE d.user_id = $1`,
      [userId]
    );

    const devices = devicesResult.rows.map((row: any) => ({
      deviceId: row.device_id,
      syncVersion: row.global_sync_version,
      lastSync: row.last_sync_time,
      status: row.global_sync_version === globalSyncVersion ? 'in_sync' : 'pending'
    }));

    return {
      globalSyncVersion,
      devices
    };
  } catch (error) {
    console.error('[Sync] Error getting sync status:', error);
    throw error;
  }
};

export const detectAndResolveConflict = async (contentId: string, userId: string): Promise<any> => {
  try {
    const result = await query(
      `SELECT * FROM sync_events 
       WHERE user_id = $1 AND content_id = $2
       ORDER BY timestamp DESC`,
      [userId, contentId]
    );

    const events = result.rows;
    if (events.length < 2) {
      return { conflict: false };
    }

    // Compare hashes of recent events
    const latest = events[0];
    const previous = events[1];

    if (latest.content_hash !== previous.content_hash) {
      return {
        conflict: true,
        resolution: 'keep_latest', // Default to latest timestamp
        latestEvent: latest,
        previousEvent: previous
      };
    }

    return { conflict: false };
  } catch (error) {
    console.error('[Sync] Error detecting conflict:', error);
    throw error;
  }
};

// Initialize device sync pointer
export const initializeDeviceSyncPointer = async (deviceId: string): Promise<void> => {
  try {
    await query(
      `INSERT INTO device_sync_pointers (device_id, global_sync_version, last_sync_time, pending_acks)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (device_id) DO NOTHING`,
      [deviceId, 0]
    );
  } catch (error) {
    console.error('[Sync] Error initializing device sync pointer:', error);
    throw error;
  }
};

// Upload backup payload with integrated cloud storage provider (abstracted S3/Google Drive)
export const uploadBackup = async (userId: string, data: any, email?: string): Promise<void> => {
  try {
    // 1. Insert into backups table
    await query(
      `INSERT INTO backups (user_id, payload)
       VALUES ($1, $2)`,
      [userId, JSON.stringify(data)]
    );

    // Calculate metadata
    const itemCount = (data.workspaces?.length || 0) + 
                      (data.captures?.length || 0) + 
                      (data.tasks?.length || 0) + 
                      (data.resources?.length || 0);
    const sizeInBytes = Buffer.byteLength(JSON.stringify(data));

    // 2. Fetch credentials (Google Tokens used if Google Drive is active)
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let targetEmail: string | null = email || null;

    if (email) {
      const tokenResult = await query(
        `SELECT encrypted_token as access_token, encrypted_refresh_token as refresh_token 
         FROM oauth_tokens 
         WHERE user_id = $1 AND email = $2 AND service = 'google'`,
        [userId, email]
      );
      if (tokenResult.rows.length > 0) {
        accessToken = tokenResult.rows[0].access_token;
        refreshToken = tokenResult.rows[0].refresh_token;
      }
    }

    if (!accessToken) {
      const userResult = await query(
        `SELECT email, google_access_token, google_refresh_token FROM users WHERE id = $1`,
        [userId]
      );
      if (userResult.rows.length > 0) {
        accessToken = userResult.rows[0].google_access_token;
        refreshToken = userResult.rows[0].google_refresh_token;
        if (!targetEmail) {
          targetEmail = userResult.rows[0].email;
        }
      }
    }

    // Gzip compress the JSON payload
    const gzipBuffer = zlib.gzipSync(JSON.stringify(data));

    let driveLocation = 'local_database/backups_table';

    try {
      const storageProvider = getStorageProvider();
      const uploadResult = await storageProvider.uploadFile(
        userId,
        gzipBuffer,
        {
          name: 'BaseBackup.json',
          mimeType: 'application/gzip'
        },
        {
          accessToken,
          refreshToken,
          email: targetEmail || undefined
        }
      );
      driveLocation = uploadResult.driveLocation;
    } catch (uploadError) {
      console.error('[Sync] Cloud backup upload failed, falling back to database only:', uploadError);
      driveLocation = 'local_database/fallback_due_to_storage_error';
    }

    // 3. Log manifest
    await query(
      `INSERT INTO backup_manifests (user_id, backup_date, item_count, total_size_bytes, drive_location, status)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5)`,
      [userId, itemCount, sizeInBytes, driveLocation, 'success']
    );
  } catch (error) {
    console.error('[Sync] Error in uploadBackup service:', error);
    throw error;
  }
};

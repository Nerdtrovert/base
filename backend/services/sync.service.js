"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDeviceSyncPointer = exports.detectAndResolveConflict = exports.getSyncStatus = exports.pullSyncChanges = exports.processSyncEvent = void 0;
const uuid_1 = require("uuid");
const postgres_1 = require("../database/postgres");
let globalSyncVersion = 0;
const processSyncEvent = async (syncRequest) => {
    try {
        const { deviceId, syncVersion, events } = syncRequest;
        // Update device sync pointer
        await (0, postgres_1.query)(`UPDATE device_sync_pointers 
       SET global_sync_version = $1, last_sync_time = CURRENT_TIMESTAMP
       WHERE device_id = $2`, [globalSyncVersion, deviceId]);
        // Insert sync events
        const conflicts = [];
        for (const event of events) {
            const eventId = (0, uuid_1.v4)();
            // Check for conflicts using content hash
            const existingEvent = await (0, postgres_1.query)(`SELECT * FROM sync_events 
         WHERE content_id = $1 AND content_hash != $2
         ORDER BY timestamp DESC LIMIT 1`, [event.id, event.hash]);
            if (existingEvent.rows.length > 0) {
                const conflict = existingEvent.rows[0];
                conflicts.push({
                    localId: event.id,
                    remoteId: conflict.id,
                    resolution: 'keep_latest'
                });
                // Log conflict
                await (0, postgres_1.query)(`INSERT INTO sync_conflicts (user_id, content_id, device_1_id, device_2_id, device_1_version, device_2_version, resolution)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    conflict.user_id,
                    event.id,
                    deviceId,
                    conflict.device_id,
                    syncVersion,
                    conflict.created_at,
                    'keep_latest'
                ]);
            }
            // Insert event
            await (0, postgres_1.query)(`INSERT INTO sync_events (id, user_id, device_id, event_type, content_id, content_hash, payload, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
                eventId,
                'user_id_placeholder', // Will be set by auth middleware
                deviceId,
                event.type,
                event.id,
                event.hash,
                JSON.stringify(event.data || {}),
                new Date(event.timestamp)
            ]);
        }
        globalSyncVersion++;
        return {
            acknowledged: true,
            newSyncVersion: globalSyncVersion,
            conflicts
        };
    }
    catch (error) {
        console.error('[Sync] Error processing sync event:', error);
        throw error;
    }
};
exports.processSyncEvent = processSyncEvent;
const pullSyncChanges = async (userId, deviceId, fromSyncVersion) => {
    try {
        // Get all sync events since last sync for this user
        const eventsResult = await (0, postgres_1.query)(`SELECT * FROM sync_events 
       WHERE user_id = $1 
       ORDER BY timestamp ASC`, [userId]);
        // Get device states
        const devicesResult = await (0, postgres_1.query)(`SELECT id, sync_version, last_sync FROM devices 
       WHERE user_id = $1`, [userId]);
        const events = eventsResult.rows;
        const deviceStates = devicesResult.rows.map((device) => ({
            deviceId: device.id,
            lastSyncVersion: device.sync_version,
            lastSeen: device.last_sync
        }));
        return {
            events,
            currentSyncVersion: globalSyncVersion,
            deviceStates
        };
    }
    catch (error) {
        console.error('[Sync] Error pulling sync changes:', error);
        throw error;
    }
};
exports.pullSyncChanges = pullSyncChanges;
const getSyncStatus = async (userId) => {
    try {
        const devicesResult = await (0, postgres_1.query)(`SELECT * FROM device_sync_pointers dsp
       JOIN devices d ON dsp.device_id = d.id
       WHERE d.user_id = $1`, [userId]);
        const devices = devicesResult.rows.map((row) => ({
            deviceId: row.device_id,
            syncVersion: row.global_sync_version,
            lastSync: row.last_sync_time,
            status: row.global_sync_version === globalSyncVersion ? 'in_sync' : 'pending'
        }));
        return {
            globalSyncVersion,
            devices
        };
    }
    catch (error) {
        console.error('[Sync] Error getting sync status:', error);
        throw error;
    }
};
exports.getSyncStatus = getSyncStatus;
const detectAndResolveConflict = async (contentId, userId) => {
    try {
        const result = await (0, postgres_1.query)(`SELECT * FROM sync_events 
       WHERE user_id = $1 AND content_id = $2
       ORDER BY timestamp DESC`, [userId, contentId]);
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
    }
    catch (error) {
        console.error('[Sync] Error detecting conflict:', error);
        throw error;
    }
};
exports.detectAndResolveConflict = detectAndResolveConflict;
// Initialize device sync pointer
const initializeDeviceSyncPointer = async (deviceId) => {
    try {
        await (0, postgres_1.query)(`INSERT INTO device_sync_pointers (device_id, global_sync_version, last_sync_time, pending_acks)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 0)
       ON CONFLICT (device_id) DO NOTHING`, [deviceId, 0]);
    }
    catch (error) {
        console.error('[Sync] Error initializing device sync pointer:', error);
        throw error;
    }
};
exports.initializeDeviceSyncPointer = initializeDeviceSyncPointer;

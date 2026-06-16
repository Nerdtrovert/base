"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = exports.query = exports.getClient = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/base_db'
});
pool.on('error', (err) => {
    console.error('[Database] Unexpected error on idle client', err);
});
const getClient = async () => {
    return pool.connect();
};
exports.getClient = getClient;
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('[Database] Query executed', { text, duration });
        return result;
    }
    catch (error) {
        console.error('[Database] Query error', { text, error });
        throw error;
    }
};
exports.query = query;
// Initialize database schema
const initializeDatabase = async () => {
    const client = await (0, exports.getClient)();
    try {
        // Users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings JSONB DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `);
        // Devices table
        await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name VARCHAR(255),
        device_type VARCHAR(50),
        os VARCHAR(50),
        unique_identifier VARCHAR(255),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_sync TIMESTAMP,
        sync_version INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, unique_identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
      CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen);
    `);
        // Refresh tokens table
        await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(device_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
    `);
        // Sync events table (immutable log)
        await client.query(`
      CREATE TABLE IF NOT EXISTS sync_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID REFERENCES devices(id),
        event_type VARCHAR(50),
        content_id VARCHAR(255),
        content_hash VARCHAR(64),
        payload JSONB,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_events_user_timestamp ON sync_events(user_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_events_device_timestamp ON sync_events(device_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_events_content_id ON sync_events(content_id);
    `);
        // Device sync pointers
        await client.query(`
      CREATE TABLE IF NOT EXISTS device_sync_pointers (
        device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
        global_sync_version INT,
        last_sync_time TIMESTAMP,
        pending_acks INT DEFAULT 0
      );
    `);
        // Sync conflicts log
        await client.query(`
      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_id VARCHAR(255),
        device_1_id UUID REFERENCES devices(id),
        device_2_id UUID REFERENCES devices(id),
        device_1_version INT,
        device_2_version INT,
        resolution VARCHAR(50),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON sync_conflicts(user_id);
    `);
        // Backup manifests
        await client.query(`
      CREATE TABLE IF NOT EXISTS backup_manifests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        backup_date TIMESTAMP,
        item_count INT,
        total_size_bytes BIGINT,
        manifest_hash VARCHAR(64),
        drive_location VARCHAR(500),
        status VARCHAR(20),
        last_verified TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_backup_manifests_user_id ON backup_manifests(user_id);
      CREATE INDEX IF NOT EXISTS idx_backup_manifests_backup_date ON backup_manifests(backup_date);
    `);
        // OAuth tokens (encrypted)
        await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service VARCHAR(50),
        scope VARCHAR(500),
        encrypted_token TEXT,
        encrypted_refresh_token TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
    `);
        console.log('[Database] Schema initialized successfully');
    }
    catch (error) {
        console.error('[Database] Error initializing schema:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.initializeDatabase = initializeDatabase;
exports.default = pool;

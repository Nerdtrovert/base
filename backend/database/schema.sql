-- SQL Schema for Base App Database

-- Enable UUID support used by the schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (supports both Google OAuth and Email/Password auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    picture VARCHAR(500),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Run migrations for users table if it already exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ALTER COLUMN google_id DROP NOT NULL;

-- Devices table
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

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Run migrations for refresh_tokens table if it already exists
ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE TEXT;

-- Sync events table (immutable log)
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

-- Device sync pointers
CREATE TABLE IF NOT EXISTS device_sync_pointers (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    global_sync_version INT,
    last_sync_time TIMESTAMP,
    pending_acks INT DEFAULT 0
);

-- Sync conflicts log
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

-- Backup manifests
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

-- Backups storage table
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backups_user_id ON backups(user_id);

-- OAuth tokens (encrypted)
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

-- Run migrations for users and oauth_tokens (Milestone 1 support)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token VARCHAR(2000);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR(2000);

ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE oauth_tokens DROP CONSTRAINT IF EXISTS unique_user_email;
ALTER TABLE oauth_tokens ADD CONSTRAINT unique_user_email UNIQUE (user_id, email);

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

-- Sent notifications tracking to avoid overloading
CREATE TABLE IF NOT EXISTS sent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'reminder' or 'motivation'
    content_identifier TEXT NOT NULL, -- e.g. task ID or date
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sent_notifications_user ON sent_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_notifications_identifier ON sent_notifications(content_identifier);


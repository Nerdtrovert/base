-- Seed data for Base App Database

-- Insert Tester user
-- Password is "test123" (bcrypt hash: $2b$10$hdoURLfoAEFs7XdBXSS84uICqxkhmuG94MoGDy0w1165frhadu8zW)
INSERT INTO users (id, email, password_hash, name, picture, settings)
VALUES (
    'f1e2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'test@base.com',
    '$2b$10$hdoURLfoAEFs7XdBXSS84uICqxkhmuG94MoGDy0w1165frhadu8zW',
    'Tester',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Tester',
    '{"theme": "dark", "fontSize": "medium"}'
)
ON CONFLICT (email) DO NOTHING;

-- Insert a default device for Tester
INSERT INTO devices (id, user_id, device_name, device_type, os, unique_identifier, last_seen, sync_version)
VALUES (
    'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6b',
    'f1e2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    'Tester Web Browser',
    'web',
    'Browser',
    'tester-web-unique-identifier',
    CURRENT_TIMESTAMP,
    1
)
ON CONFLICT (user_id, unique_identifier) DO NOTHING;

-- Initialize Tester's device sync pointer
INSERT INTO device_sync_pointers (device_id, global_sync_version, last_sync_time, pending_acks)
VALUES (
    'd1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6b',
    1,
    CURRENT_TIMESTAMP,
    0
)
ON CONFLICT (device_id) DO NOTHING;

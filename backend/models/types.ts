// Database and API types for Base backend

export interface User {
  id: string;
  email: string;
  google_id: string;
  name?: string;
  picture?: string;
  created_at: Date;
  updated_at: Date;
  settings: Record<string, unknown>;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  unique_identifier: string;
  last_seen: Date;
  last_sync: Date;
  sync_version: number;
  created_at: Date;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  device_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

export interface SyncEvent {
  id: string;
  user_id: string;
  device_id: string;
  event_type: string;
  content_id: string;
  content_hash: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  created_at: Date;
}

export interface DeviceSyncPointer {
  device_id: string;
  global_sync_version: number;
  last_sync_time: Date;
  pending_acks: number;
}

export interface SyncConflict {
  id: string;
  user_id: string;
  content_id: string;
  device_1_id: string;
  device_2_id: string;
  device_1_version: number;
  device_2_version: number;
  resolution: string;
  resolved_at: Date;
  created_at: Date;
}

export interface BackupManifest {
  id: string;
  user_id: string;
  backup_date: Date;
  item_count: number;
  total_size_bytes: number;
  manifest_hash: string;
  drive_location: string;
  status: 'synced' | 'pending' | 'failed';
  last_verified: Date;
  created_at: Date;
}

export interface OAuthToken {
  id: string;
  user_id: string;
  service: 'google';
  scope: string;
  encrypted_token: string;
  encrypted_refresh_token: string;
  expires_at: Date;
  created_at: Date;
}

// Request/Response types
export interface AuthCallbackRequest {
  code: string;
  state?: string;
  redirect_uri: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  deviceId: string;
  expiresIn: number;
}

export interface SyncEventPayload {
  type: string;
  id: string;
  timestamp: number;
  hash: string;
  data?: Record<string, unknown>;
}

export interface SyncRequest {
  deviceId: string;
  syncVersion: number;
  events: SyncEventPayload[];
}

export interface SyncResponse {
  acknowledged: boolean;
  newSyncVersion: number;
  conflicts: Array<{
    localId: string;
    remoteId: string;
    resolution: string;
  }>;
}

export interface SyncPullRequest {
  deviceId: string;
  fromSyncVersion: number;
}

export interface SyncPullResponse {
  events: SyncEvent[];
  currentSyncVersion: number;
  deviceStates: Array<{
    deviceId: string;
    lastSyncVersion: number;
    lastSeen: Date;
  }>;
}

export interface WebhookPayload {
  userId: string;
  sourceDeviceId: string;
  syncVersion: number;
  events: SyncEvent[];
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

# Base Backend Architecture

## Philosophy

**Thin Orchestration Layer** — Backend exists only to:
1. Authenticate users (OAuth2 with Google)
2. Coordinate multi-device synchronization
3. Manage user identity & device registry
4. Provide webhooks for offline-to-cloud sync events

**User Content Remains Local** — All notes, tasks, resources, and workspace data stay in:
- User's IndexedDB (primary)
- User's Google Drive App Folder (secondary backup)
- Never touches the Base backend

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (PWA)                           │
│  React + TypeScript + Zustand + IndexedDB + Dexie.js       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Local State     │  │  Google Drive    │                │
│  │  (IndexedDB)     │  │  Sync Module     │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                           │
│           └──────────┬──────────┘                           │
│                      │                                       │
│            ┌─────────▼────────┐                            │
│            │ Sync Orchestrator │ (offline-aware)           │
│            │  - Queue changes  │                            │
│            │  - Conflict mgmt  │                            │
│            └─────────┬────────┘                            │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      │ HTTPS
                      │
        ┌─────────────▼──────────────────┐
        │   Base Orchestration Backend    │
        ├─────────────────────────────────┤
        │ Node.js + Express + TypeScript  │
        └─────────────────────────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
   ┌────▼────┐  ┌─────▼────┐  ┌────▼─────┐
   │  Auth   │  │ Device   │  │  Webhooks│
   │ Service │  │ Registry │  │ Manager  │
   └─────────┘  └──────────┘  └──────────┘
        │             │              │
        │      ┌──────▼──────┐       │
        │      │  PostgreSQL │       │
        │      │  (User meta)│       │
        │      └─────────────┘       │
        │                            │
   ┌────▼────────────────────────────▼──┐
   │     Google Cloud / AWS             │
   │  - OAuth Identity Provider         │
   │  - Device sync webhooks (Pub/Sub)  │
   └───────────────────────────────────┘
```

---

## Core Services

### 1. Authentication Service

**Purpose:** OAuth2 flow, session management, device registration.

#### Endpoints

```
POST /api/auth/google/callback
  Input: { code, state, redirect_uri }
  Output: { accessToken, refreshToken, userId, deviceId }
  - Exchange Google auth code for tokens
  - Register device in user's device registry
  - Return JWT for subsequent API calls

POST /api/auth/refresh
  Input: { refreshToken }
  Output: { accessToken, expiresIn }
  - Refresh expired access token

POST /api/auth/logout
  Input: { deviceId }
  Output: { success: boolean }
  - Invalidate device session
  - Remove from device registry
```

#### Database Schema

```sql
-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{}'  -- User preferences
);

-- Devices Table (device registry)
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255),  -- "Alice's Laptop", "Alice's Phone"
  device_type ENUM('desktop', 'tablet', 'mobile'),
  os VARCHAR(50),  -- "macOS 14.0", "iOS 17"
  unique_identifier VARCHAR(255),  -- Browser fingerprint + OS
  last_seen TIMESTAMP,
  last_sync TIMESTAMP,
  sync_version INT DEFAULT 0,  -- Track sync state version
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, unique_identifier)
);

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 2. Device Registry & Sync Orchestration

**Purpose:** Track devices, coordinate sync, detect conflicts.

#### Endpoints

```
GET /api/devices
  Authorization: Bearer {accessToken}
  Output: { devices: [{ id, name, type, lastSeen, lastSync }] }
  - List all user devices

POST /api/sync/events
  Authorization: Bearer {accessToken}
  Input: {
    deviceId,
    syncVersion,  -- Current device state version
    events: [
      { type: 'note_created', id, timestamp, hash },
      { type: 'task_updated', id, timestamp, hash },
      { type: 'workspace_renamed', id, timestamp, hash }
    ]
  }
  Output: { 
    acknowledged: true,
    newSyncVersion: 42,
    conflicts: [{ localId, remoteId, resolution: 'keep_latest' }]
  }
  - Receive sync events from device
  - Detect conflicts using hash comparison
  - Return new sync version
  - Emit webhook to other devices

POST /api/sync/pull
  Authorization: Bearer {accessToken}
  Input: { deviceId, fromSyncVersion }
  Output: {
    events: [...],
    currentSyncVersion: 42,
    deviceStates: [
      { deviceId, lastSyncVersion, lastSeen }
    ]
  }
  - Pull changes from other devices since last sync

GET /api/sync/status
  Authorization: Bearer {accessToken}
  Output: {
    globalSyncVersion: 42,
    devices: [{ deviceId, syncVersion, lastSync, status: 'in_sync' }]
  }
  - Check sync status across all devices
```

#### Database Schema

```sql
-- Sync Events (immutable log)
CREATE TABLE sync_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id),
  event_type VARCHAR(50),  -- 'note_created', 'task_updated', etc.
  content_id VARCHAR(255),  -- Reference to note/task/workspace
  content_hash VARCHAR(64),  -- SHA256 of content for conflict detection
  payload JSONB,  -- Full event data for replay
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX(user_id, timestamp),
  INDEX(device_id, timestamp)
);

-- Device Sync Pointers
CREATE TABLE device_sync_pointers (
  device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  global_sync_version INT,  -- Last version synced to
  last_sync_time TIMESTAMP,
  pending_acks INT DEFAULT 0  -- Unacknowledged events
);

-- Conflict Resolution Log
CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id VARCHAR(255),
  device_1_id UUID REFERENCES devices(id),
  device_2_id UUID REFERENCES devices(id),
  device_1_version INT,
  device_2_version INT,
  resolution VARCHAR(50),  -- 'keep_latest', 'keep_device_1', 'keep_device_2', 'merge'
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3. Webhook & Event Broadcasting

**Purpose:** Push sync events to other devices in real-time.

#### Architecture

```
Device A pushes change
        ↓
Backend receives sync event
        ↓
Emit to pub/sub (Google Cloud Pub/Sub or AWS SNS)
        ↓
Device B, C, D receive webhook
        ↓
Pull changes from sync/pull endpoint
        ↓
Merge into local IndexedDB
```

#### Implementation

```
POST /api/webhooks/sync-event
  (Internal: called by sync/events endpoint)
  Input: { userId, excludeDeviceId, eventBatch }
  
  Pub/Sub Topic: base-sync-events-{userId}
  Subscribers: All devices except the one that initiated
  
  Webhook Payload:
  {
    userId,
    sourceDeviceId,
    syncVersion,
    events: [...]
  }
```

**Frontend Webhook Listener:**
```typescript
// In PWA service worker or background sync
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'SYNC_WEBHOOK') {
    // Queue sync pull from backend
    syncManager.schedulePull();
  }
});
```

---

### 4. Data Integrity & Backup Coordination

**Purpose:** Verify user data is backed up, coordinate Google Drive sync.

#### Endpoints

```
GET /api/backup/status
  Authorization: Bearer {accessToken}
  Output: {
    lastBackup: ISO8601,
    backupSize: 1234567,
    backupLocation: 'google-drive',
    status: 'synced' | 'pending' | 'error'
  }
  - Check backup status without storing data

POST /api/backup/initiate
  Authorization: Bearer {accessToken}
  Input: { sourceDeviceId }
  Output: { driveAuthUrl, requestId }
  - Request Google Drive scopes if not already granted
  - Prepare for first-time backup sync

POST /api/backup/verify
  Authorization: Bearer {accessToken}
  Input: { backupHash, itemCount }
  Output: { verified: boolean, missingItems: [...] }
  - Verify backup integrity without storing content
  - Return list of items missing from Drive
```

#### Database Schema

```sql
-- Backup Manifest (stores metadata only, not content)
CREATE TABLE backup_manifests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  backup_date TIMESTAMP,
  item_count INT,
  total_size_bytes BIGINT,
  manifest_hash VARCHAR(64),  -- Hash of all content hashes
  drive_location VARCHAR(500),  -- Google Drive app folder path
  status ENUM('synced', 'pending', 'failed'),
  last_verified TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth Tokens (encrypted)
CREATE TABLE oauth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service ENUM('google'),
  scope VARCHAR(500),  -- Scopes granted
  encrypted_token TEXT,  -- Encrypted with KMS
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Security

### Authentication Flow

```
1. User initiates Google OAuth on Frontend
2. Frontend exchanges code for token via GET /api/auth/google/callback
3. Backend issues JWT (access token) + refresh token
4. Frontend includes JWT in Authorization header for all requests
5. Backend validates JWT signature
6. Backend rate-limits by device
```

### Authorization Model

```
- Users can only access their own data
- Devices can only access data for their registered user
- Service-to-service: API keys (for future integrations)
```

### Data Protection

```
- All API traffic: HTTPS/TLS 1.3
- Refresh tokens: HttpOnly, Secure cookies (fallback: opaque tokens)
- OAuth tokens (for Google Drive): Encrypted at rest with AWS KMS
- Sensitive payloads: Encrypted with user's public key (optional E2E layer)
```

---

## Deployment & Infrastructure

### Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Node.js 18+ | Async I/O for webhooks |
| Framework | Express.js + TypeScript | Lightweight, familiar |
| Database | PostgreSQL 15+ | ACID compliance, JSONB for events |
| Cache | Redis | Session management, rate limiting |
| Message Queue | Google Cloud Pub/Sub | Real-time device sync |
| Storage | Google Cloud Storage | Encrypted backup manifests |
| Secrets | Google Secret Manager | OAuth tokens, KMS keys |

### Hosting Options

**Option A: Vercel** (Recommended for tight frontend integration)
```
- Frontend: Vercel Edge Network
- Backend: Vercel Functions (Node.js serverless)
- Database: Vercel Postgres
- Storage: Google Cloud Storage
```

**Option B: Google Cloud** (Native integration)
```
- Backend: Cloud Run (containerized Node.js)
- Database: Cloud SQL (PostgreSQL)
- Message Queue: Cloud Pub/Sub
- Secrets: Secret Manager
- Cost: ~$50-200/month at scale
```

**Option C: Self-hosted** (Future)
```
- Docker container on any VPS
- Environment: Docker Compose for dev, Kubernetes for prod
```

---

## Deployment Configuration

### Environment Variables

```env
# OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://base.app/api/auth/google/callback

# Database
DATABASE_URL=postgresql://user:pass@host:5432/base_prod
REDIS_URL=redis://cache.internal:6379

# JWT
JWT_SECRET=<long-random-key>
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Pub/Sub
GCP_PROJECT_ID=base-prod-123
GCP_PUBSUB_TOPIC=base-sync-events

# Encryption
KMS_KEY_URI=gcp-kms://projects/base-prod-123/locations/us-central1/keyRings/base/cryptoKeys/oauth-tokens

# Observability
SENTRY_DSN=https://key@sentry.io/123
LOG_LEVEL=info
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### GitHub Actions CI/CD

```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci && npm run test && npm run lint
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy base-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT }}/base-backend \
            --region us-central1 \
            --set-env-vars DATABASE_URL=${{ secrets.DATABASE_URL }}
```

---

## Error Handling & Resilience

### Sync Conflict Resolution

When two devices make conflicting changes:

```
Device A: Updates note at 10:00:00 UTC, hash = abc123
Device B: Updates same note at 10:00:05 UTC, hash = def456

Backend detects conflict (same content_id, different hashes)

Resolution Strategy:
1. Latest-timestamp wins (Device B)
2. Both versions stored with merge markers
3. User is notified: "This note was edited on another device"
4. Frontend shows merge UI: Accept local / Accept remote / Manual merge
```

### Network Failures

```
Device offline during push attempt:
→ Offline queue in IndexedDB
→ Service worker stores events
→ When online: Batch send all events
→ Backend deduplicates using timestamps + device_id

Device receives stale sync version:
→ Backend returns 409 Conflict
→ Frontend pulls latest changes
→ Retry with updated sync version
```

### Rate Limiting

```
Per device (by device_id):
- 100 requests per minute
- 1MB payload per request
- 1000 sync events per batch

Headers:
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1625097600
```

---

## Monitoring & Observability

### Key Metrics

```
- Sync latency: Time from push to pull available (target: <5s)
- Conflict rate: % of syncs with conflicts (target: <1%)
- Device active rate: Devices active per day
- Webhook delivery rate: % of webhooks delivered (target: >99.9%)
- Data backup status: % of users with recent backup
```

### Logging

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "sync-orchestrator",
  "userId": "user-123",
  "deviceId": "device-456",
  "event": "sync_event_processed",
  "syncVersion": 42,
  "eventCount": 5,
  "conflictCount": 0,
  "durationMs": 145
}
```

### Alerting

```
- Webhook delivery failure rate > 0.1% → Alert
- Sync latency p95 > 30s → Alert
- Database CPU > 80% → Alert
- OAuth token expiry approaching → Alert
```

---

## Data Privacy & Compliance

### GDPR Compliance

- User can request data export: `/api/user/export`
- User can request deletion: `/api/user/delete` (soft delete + anonymization)
- Privacy policy: Minimal data collection, no tracking
- Data residency: EU data in EU regions

### SOC 2 Readiness

- Encrypt OAuth tokens at rest (KMS)
- Audit logs for all data access
- Regular penetration testing
- Incident response plan

---

## Future Enhancements

### Phase 2 (Post V1)

1. **Collaborative Workspaces**
   - Share workspace with roommates/group members
   - Conflict resolution UI for collaborative edits

2. **AI Features**
   - Semantic search across content
   - Auto-tagging & categorization
   - Meeting notes summarization

3. **Advanced Sync**
   - Delta sync (only changed fields)
   - Bandwidth optimization for mobile
   - Offline sync deduplication

4. **Analytics**
   - Private, on-device analytics (no tracking)
   - Productivity insights with full user control

---

## Repository Structure

```
base/
├── frontend/               # React PWA (existing)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/               # NEW: Orchestration backend
│   ├── src/
│   │   ├── index.ts       # Express app entry
│   │   ├── auth/          # OAuth service
│   │   ├── sync/          # Sync orchestrator
│   │   ├── devices/       # Device registry
│   │   ├── backup/        # Backup coordination
│   │   ├── middleware/    # Auth, logging, rate limit
│   │   ├── models/        # Database schemas
│   │   └── utils/         # Helpers, crypto
│   ├── tests/
│   ├── docker-compose.yml # Local dev stack
│   ├── Dockerfile
│   └── package.json
│
├── db/
│   ├── migrations/        # SQL migrations
│   └── seeds/             # Dev data
│
└── docs/
    └── BACKEND_ARCHITECTURE.md (this file)
```

---

## Getting Started (Developer Setup)

```bash
# Start PostgreSQL + Redis locally
docker-compose up -d

# Install dependencies
cd backend
npm install

# Set up environment
cp .env.example .env

# Run migrations
npm run migrate:latest

# Start dev server (with hot reload)
npm run dev

# Run tests
npm run test

# Lint
npm run lint
```

---

## Summary

This backend is a **thin orchestration layer** that:

✅ **Enables** authentication, device registry, multi-device sync
✅ **Never stores** user content (stays in IndexedDB + Google Drive)
✅ **Coordinates** conflict resolution without being opinionated
✅ **Scales efficiently** with serverless/containerized architecture
✅ **Respects privacy** with user-owned data philosophy

The frontend remains the source of truth for all user content. The backend is stateless, event-driven, and designed to fail gracefully.

# Base Backend API Documentation

A thin orchestration layer for the Base PWA that enables authentication, multi-device synchronization, and cloud backup coordination.

## Architecture

```
Frontend (PWA)
    ↓
Base Backend (Node.js + Express)
    ├─ Auth Service (Google OAuth 2.0 + JWT)
    ├─ Sync Orchestrator (Device coordination)
    ├─ Device Registry (Multi-device tracking)
    └─ Backup Coordinator (Google Drive)
    ↓
PostgreSQL Database
```

## Features

✅ **Authentication** — Google OAuth 2.0 with JWT tokens
✅ **Multi-Device Sync** — Coordinate changes across devices
✅ **Conflict Detection** — Hash-based conflict resolution
✅ **Rate Limiting** — Per-device and per-user request limits
✅ **Real-time Webhooks** — Google Pub/Sub integration (optional)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Google OAuth 2.0 credentials
- (Optional) Google Cloud project for Pub/Sub

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

**Required:**
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_CLIENT_ID` — From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
- `JWT_SECRET` — Min 32 characters for production

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development server (with hot reload)
npm run dev

# Run production server
npm start
```

## API Documentation

### Authentication Endpoints

#### Get Google OAuth URL
```
GET /api/auth/google/url
```

Returns the Google OAuth authorization URL.

**Response:**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### OAuth Callback
```
POST /api/auth/google/callback
Content-Type: application/json

{
  "code": "4/...",
  "deviceInfo": {
    "deviceId": "device-uuid",
    "name": "Alice's Laptop",
    "type": "desktop",
    "os": "macOS 14.0",
    "unique_identifier": "fingerprint-hash"
  }
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "user-uuid",
  "deviceId": "device-uuid",
  "expiresIn": 900
}
```

#### Refresh Access Token
```
POST /api/auth/refresh
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "accessToken": "new-token",
  "expiresIn": 900
}
```

#### Get User Profile
```
GET /api/auth/profile
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "Alice",
  "picture": "https://...",
  "settings": {}
}
```

#### Logout
```
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

### Sync Endpoints

#### Initialize Device Sync
```
POST /api/sync/init
Authorization: Bearer {accessToken}

{
  "deviceId": "device-uuid"
}
```

#### Push Sync Events
```
POST /api/sync/events
Authorization: Bearer {accessToken}

{
  "deviceId": "device-uuid",
  "syncVersion": 42,
  "events": [
    {
      "type": "note_created",
      "id": "note-id",
      "timestamp": 1625097600000,
      "hash": "abc123def456",
      "data": { ... }
    }
  ]
}
```

**Response:**
```json
{
  "acknowledged": true,
  "newSyncVersion": 43,
  "conflicts": []
}
```

#### Pull Sync Changes
```
POST /api/sync/pull
Authorization: Bearer {accessToken}

{
  "deviceId": "device-uuid",
  "fromSyncVersion": 42
}
```

**Response:**
```json
{
  "events": [
    {
      "id": "event-uuid",
      "user_id": "user-uuid",
      "device_id": "device-uuid",
      "event_type": "note_created",
      "content_id": "note-id",
      "content_hash": "abc123def456",
      "payload": { ... },
      "timestamp": "2024-01-15T10:30:45.123Z"
    }
  ],
  "currentSyncVersion": 43,
  "deviceStates": [
    {
      "deviceId": "device-uuid",
      "lastSyncVersion": 42,
      "lastSeen": "2024-01-15T10:30:45.123Z"
    }
  ]
}
```

#### Get Sync Status
```
GET /api/sync/status
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "globalSyncVersion": 43,
  "devices": [
    {
      "deviceId": "device-uuid",
      "syncVersion": 42,
      "lastSync": "2024-01-15T10:30:45.123Z",
      "status": "pending"
    }
  ]
}
```

### Device Endpoints

#### List Devices
```
GET /api/devices
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "devices": [
    {
      "id": "device-uuid",
      "device_name": "Alice's Laptop",
      "device_type": "desktop",
      "last_seen": "2024-01-15T10:30:45.123Z",
      "last_sync": "2024-01-15T10:30:45.123Z",
      "sync_version": 42
    }
  ]
}
```

#### Get Active Device Count
```
GET /api/devices/count
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "activeDevices": 2
}
```

#### Delete Device
```
DELETE /api/devices/{deviceId}
Authorization: Bearer {accessToken}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "status": 400
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Bad Request | Missing or invalid parameters |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Sync version mismatch |
| 413 | Payload Too Large | Request body exceeds 1MB |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

## Rate Limiting

Requests are rate-limited per device:

- **General endpoints**: 100 requests/minute
- **Auth endpoints**: 10 requests/15 minutes
- **Sync endpoints**: 50 requests/minute
- **Max payload**: 1MB
- **Max sync events per batch**: 1000

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1625097600
```

## Authentication Flow

### OAuth 2.0 with Google

1. Frontend calls `GET /api/auth/google/url` to get authorization URL
2. User logs in with Google
3. Google redirects to `GOOGLE_REDIRECT_URI`
4. Frontend exchanges `code` by calling `POST /api/auth/google/callback`
5. Backend returns `accessToken` + `refreshToken`
6. Frontend stores `refreshToken` in HttpOnly cookie
7. Frontend uses `accessToken` in Authorization header for API calls

### Token Refresh

- Access tokens expire in **15 minutes**
- Refresh tokens expire in **7 days**
- Call `POST /api/auth/refresh` to get new access token
- Refresh automatically before expiry on frontend

## Sync Architecture

### Event-Based Synchronization

1. Device A makes a change (create note, update task, etc.)
2. Frontend queues event with timestamp + content hash
3. Device A calls `POST /api/sync/events` with batch of events
4. Backend stores events in immutable log
5. Backend detects conflicts using content hash comparison
6. Backend emits webhook to Google Pub/Sub (optional)
7. Other devices receive webhook, call `POST /api/sync/pull`
8. Devices merge changes locally into IndexedDB

### Conflict Resolution

When two devices modify the same content:

1. Backend detects: same `content_id` but different `content_hash`
2. Default resolution: **keep latest** (by timestamp)
3. Log conflict in `sync_conflicts` table
4. Frontend is notified in sync response
5. (Future) Show merge UI to user if needed

## Database Schema

See `database/postgres.ts` for complete schema. Key tables:

- `users` — User accounts
- `devices` — Registered devices per user
- `sync_events` — Immutable log of all changes
- `device_sync_pointers` — Track sync state per device
- `sync_conflicts` — Log of detected conflicts
- `refresh_tokens` — Session management
- `oauth_tokens` — Encrypted Google OAuth tokens (future)

## Development

### Local PostgreSQL Setup

```bash
# Using Docker
docker run -d \
  --name base-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=base_db \
  -p 5432:5432 \
  postgres:15

# Or use docker-compose (if available)
docker-compose up -d
```

### TypeScript Compilation

```bash
# Watch mode during development
npm run dev

# Build once
npm run build

# Check for type errors
npx tsc --noEmit
```

## Deployment

### Environment Setup

For production, ensure:

1. `NODE_ENV=production`
2. `FRONTEND_URL` is correct domain
3. `JWT_SECRET` is long and random (min 32 chars)
4. `DATABASE_URL` points to production database
5. Google OAuth credentials for production domain
6. HTTPS enabled for all endpoints
7. CORS configured for production frontend

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5001
CMD ["node", "dist/index.js"]
```

### Cloud Deployment

- **Vercel**: Serverless Node.js + Postgres
- **Google Cloud Run**: Containerized with Cloud SQL
- **AWS Lambda**: Function as a Service
- **DigitalOcean App Platform**: Managed platform

## Monitoring & Logging

All requests are logged with:
- Method, path, status code
- Response time
- User ID (if authenticated)
- Error details (if applicable)

Example:
```
[GET] /api/sync/status - 200 - 145ms
[POST] /api/sync/events - 201 - 234ms
[GET] /api/devices - 200 - 89ms
```

## Future Enhancements

- Real-time sync via WebSocket
- Collaborative editing with operational transforms
- Semantic search across synced content
- Privacy-preserving analytics
- Bandwidth optimization for mobile
- Delta sync (only changed fields)

## Support

For issues or questions:
- Check logs: `npm run dev` and inspect console
- Review API docs above
- Check GitHub issues
- Create new issue with details

## License

MIT

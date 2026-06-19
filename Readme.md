# Base

> **A workspace that remembers, so you can focus.**

Base is an offline-first student workspace that acts as a **memory layer** over your existing workflow. Instead of replacing Google Drive, Notes, Pinterest, or your local folders, Base quietly connects ideas, tasks, resources, files, and references into a single searchable workspace.

Its goal is simple:

> **Spend less time managing information and more time learning, building, designing, coding, and creating.**

---

## 🧠 Product Vision & Core Principles

Base is not:
- ❌ Another notes app
- ❌ Another task manager
- ❌ Another cloud drive
- ❌ Another productivity dashboard

Base is built on a **Local First • User Owned Data** philosophy:
- **IndexedDB (Dexie) is Primary:** All writes and reads happen instantly in local IndexedDB. The UI updates optimistically within milliseconds.
- **Offline First:** Fully functional without an internet connection. Changes are queued locally and synchronized quietly in the background when connectivity resumes.
- **Zero-Friction Backup:** Users never manually click "Save" or "Sync". Data protection runs silently.

---

## ✨ Features

### 💡 Universal Capture
Capture thoughts instantly (notes, images, links, references) without folders, tags, or friction.

### 🔍 Universal Search
Unified search index powered by Fuse.js for workspaces, notes, tasks, timeline events, and local resource contents.

### 📚 Workspaces
Organize naturally by subject or project. Each workspace tracks its own timeline, tasks, and reference assets.

### 🕒 Chronological Timeline
Every capture, edit, and interaction is saved chronologically to reconstruct your cognitive history.

### ✅ Smart Tasks
A calendar and list view (Today, Tomorrow, Upcoming, Completed) built to reduce pressure.

### 📁 Local Directory & PDF Indexing (Laptops & Mobile)
Base indexes local folders recursively to build full-text search databases of your learning resources.
- **Laptops/Desktops:** Leverages the native *File System Access API* (`showDirectoryPicker`) for recursive folder traversal.
- **Mobile Browsers:** Uses a custom *webkitdirectory file picker fallback* for selecting directories.
- **Content Parsing:** Extracts text contents from `.pdf` documents using `pdfjs-dist` alongside raw `.txt`/`.md` files to allow deep search.

### ☁️ Automatic Background Sync & Protection
- **Dexie Sync Queue:** Every local mutation enqueues a sync event. The background sync worker (`processSyncQueue`) processes these events.
- **Google Drive Snapshotting:** Compresses and uploads database snapshots (workspaces, captures, tasks, resources, and mounted folder sources) directly into the user's private Google Drive storage.
- **In-Flight Safety Guards:** Utilizes the browser `beforeunload` events to prompt users if they attempt to exit the tab with unsynced changes.
- **Reconnect Triggers:** Registers `online` status listeners to automatically run sync as soon as internet connection resumes.

### 📱 PWA & Persistent Storage (Wipeout Protection)
- **Installable PWA:** Installable directly in mobile and desktop browsers for native offline operations.
- **Storage Persistence:** On startup, Base requests persistent storage access (`navigator.storage.persist()`). The browser white-lists Base, ensuring IndexedDB data is never evicted due to browser upgrades, redeploys, or device storage pressure.

### 🔔 Quiet VAPID Push Notifications
- Registers Service Workers and exchanges VAPID keys for quiet background push reminders.
- Schedules calendar event reminders (4 hours before check-ins) and quiet motivational morning focus prompts in the background.

### 💻 Multi-Device Session Manager
- A dedicated **Connected Devices Manager Modal** under settings lets users monitor active sessions, device types (laptops, phones), last active timestamps, sync versions, and revoke session access dynamically.

---

## 🏗 Tech Stack

### Frontend & UI
- React (Vite environment)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion

### Client-Side Engine
- **Zustand:** Optimistic global store
- **Dexie.js (IndexedDB):** Client-side relational tables (workspaces, captures, tasks, resources, knowledgeSources, syncQueue)
- **Fuse.js:** Fuzzy full-text indexing
- **PDF.js:** In-browser PDF parser

### Backend API & Ledger
- **Express.js (Node):** Quiet API ledger
- **PostgreSQL:** Stores user profiles, linked OAuth drives, push subscription keys, and active device sessions
- **Google OAuth & Drive API:** Handles secure cloud backup channels

---

## 📂 Data Lifecycle & Flow

```text
User Input
   │
   ▼
[IndexedDB (Primary Store)] ──(Optimistic UI Update)──► UI View
   │
   ▼
[Dexie Sync Queue Event]
   │
   ▼
[Background Sync Worker]
   │
   ├──► PostgreSQL metadata ledger & Device registry
   ▼
[Google Drive Cloud Backup (Compressed Workspace snapshot)]
```

---

## 🎨 Onboarding & About Flow

Upon signing up or mounting a knowledge source (Google Drive folders or local directories), Base immediately redirects the user to the **About Page** (`/about?onboarding=true`).
- While they read about Base's local-first philosophy, initial synchronization and local file indexing run silently in the background.
- A status card monitors progress. Once the sync queue is successfully cleared, a glowing CTA **"Your Base is Ready"** appears, routing them to the home page.

---

## 🚀 Dev Commands

To start the local environment:

```bash
# Backend server
cd backend
npm run dev

# Frontend app
cd frontend
npm run dev
```

To validate types and production builds:
```bash
# Frontend build
cd frontend
npm run build
```
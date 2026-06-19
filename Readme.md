# Base

> **A workspace that remembers, so you can focus.**

Base is an offline-first student workspace that acts as a **memory layer** over your existing workflow. Instead of replacing Google Drive, Notes, Pinterest, or your local folders, Base quietly connects ideas, tasks, resources, files, and references into a single searchable workspace.

Its goal is simple:

> **Spend less time managing information and more time learning, building, designing, coding, and creating.**

---

## 🧠 Product Vision

Base is not:
- ❌ Another notes app
- ❌ Another task manager
- ❌ Another cloud drive
- ❌ Another productivity dashboard

Base is a **smart notebook** that quietly remembers everything surrounding your work.
Open it, continue where you left off, and get back to thinking.

---

## ✨ Features

### 💡 Universal Capture

Capture thoughts instantly.
- Notes
- Images
- Links
- References
No folders. No tags. No unnecessary decisions.

---

### 🔍 Universal Search

Search everything from one place.

- Workspaces
- Notes
- Tasks
- Resources
- Timeline
- Recent captures

Search becomes navigation.

---

### 📚 Workspaces

Organize work naturally by:
- Semester
- Subject
- Project
Each workspace maintains its own timeline, tasks, resources, and notes.

---

### 🕒 Timeline

Every interaction becomes part of a chronological project memory.

Remember:
- what you saved,
- why you saved it,
- and when you worked on it.
---

### ✅ Smart Tasks

A simple task view:
- Today
- Tomorrow
- Next 7 Days
- Completed
No productivity scores.
No streaks.
No pressure.

---

### 📌 Resources

Base doesn't duplicate your files.
Instead, it remembers them.
Resources can point to:
- Google Drive
- Local Files
- PDFs
- Images
- External Links

> Your files stay where they are. Base simply remembers them.

---

### 📅 Coming Up

A lightweight calendar widget displaying the next three upcoming events for a quick overview of what's next.

---

## 🎯 Philosophy

Base follows a few simple principles:
- Capture first, organize later.
- Search instead of navigation.
- Workspaces instead of folders.
- Context over storage.
- Local-first, cloud-enabled.
- Calm over productivity pressure.
Every feature should reduce cognitive load rather than add to it.

---

## 🏗 Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- React Router

### State

- Zustand

### Local Storage

- IndexedDB
- Dexie.js

### Search

- Fuse.js

### Cloud Integration

- Google OAuth
- Google Drive API

---

## 📂 Architecture

```text
User
↓
Capture
↓
IndexedDB (Source of Truth)
↓
Search Index + Timeline
↓
Background Sync
↓
Google Drive
↓
Other Device
↓
IndexedDB
↓
UI
```

---

## 🏠 Home Experience

```
BASE
🔍 Search Everything
💡 New Idea
▶ Continue Working
📅 Coming Up
✅ Today's Tasks
🕒 Recent Activity
📌 Pinned Resources

```
The homepage is intentionally simple.
Every element exists to help the user return to work immediately.

---

## 🎨 Design Language

Keywords:
- Calm
- Minimal
- Spacious
- Notebook-inspired
- Friendly
- Fast
The interface should feel like opening a clean notebook already turned to the page you were working on yesterday.

---

## 😊 Companion

Base includes small contextual messages that support the user without interrupting them.
Examples:
> Auto-saved. Future-you says thanks.
> Looks like a busy day. Let's finish one thing at a time.
> You've been here for a while. Stretch?
No guilt.
No streaks.
No aggressive notifications.
Just quiet assistance.
---

## 🚀 Guiding Principle

Before adding any feature, ask:
- Does it reduce cognitive load?
- Does it reduce searching?
- Does it preserve context?
- Does it help the user return to thinking faster?
If not, it doesn't belong in Base.

---

## 🌱 Mission
Students already spend enough time managing folders, files, tabs, and deadlines.
Base exists to quietly remember everything else.
> **A workspace that remembers, so you can focus.**
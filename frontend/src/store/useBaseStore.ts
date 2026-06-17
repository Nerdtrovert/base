import { create } from 'zustand';
import { db, type Workspace, type Capture, type Task, type Resource } from '../services/db';


interface User {
  name: string;
  email: string;
  picture: string;
}

export interface DriveAccount {
  email: string;
  isActive: boolean;
  fileCount: number;
  connectedAt: number;
}

interface BaseState {
  // UI States
  activeWorkspaceId: string | null;
  searchQuery: string;
  isSearchOpen: boolean;
  companionMessage: { text: string; type: 'info' | 'success' | 'warning' } | null;
  
  // Auth & Sync States
  isAuthenticated: boolean;
  isMockAuth: boolean;
  user: User | null;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSynced: number | null;
  isAuthLoading: boolean;

  // Actions
  setActiveWorkspaceId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  showCompanionMessage: (text: string, type?: 'info' | 'success' | 'warning', duration?: number) => void;
  clearCompanionMessage: () => void;

  // Database Mutations (IndexedDB is source of truth, these wrap Dexie)
  createWorkspace: (name: string, description?: string) => Promise<string>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  
  createCapture: (params: { workspaceId: string | null; type: Capture['type']; content: string; url?: string; mediaPath?: string }) => Promise<void>;
  updateCaptureWorkspace: (id: string, workspaceId: string | null) => Promise<void>;
  deleteCapture: (id: string) => Promise<void>;
  
  createTask: (title: string, workspaceId: string | null, dueDate?: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  
  createResource: (params: { title: string; url: string; type: Resource['type']; workspaceId: string | null; extractedText?: string }) => Promise<void>;
  toggleResourcePin: (id: string) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;

  // Sync & Auth API Calls
  checkAuthStatus: () => Promise<void>;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<boolean>;
  registerWithGDrive: (params: {
    email: string;
    password: string;
    name: string;
    google_id: string;
    picture: string;
    access_token: string;
    refresh_token: string;
    scope: string;
    expiry_date: string;
  }) => Promise<boolean>;
  logout: () => Promise<void>;
  triggerSync: () => Promise<void>;

  // Drive Accounts
  connectedDriveAccounts: DriveAccount[];
  addDriveAccount: (email: string) => void;
  removeDriveAccount: (email: string) => void;
  toggleDriveAccountActive: (email: string) => void;
}

const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5001';
  const hostname = window.location.hostname;
  
  // Support Microsoft Dev Tunnels dynamically (e.g. mapping frontend *-5173 to backend *-5001)
  if (hostname.includes('devtunnels.ms')) {
    return window.location.origin.replace('-5173', '-5001');
  }
  
  return `http://${hostname}:5001`;
};

const BACKEND_URL = getBackendUrl();

export const useBaseStore = create<BaseState>((set, get) => ({
  activeWorkspaceId: null,
  searchQuery: '',
  isSearchOpen: false,
  companionMessage: null,
  
  isAuthenticated: false,
  isMockAuth: true,
  user: null,
  syncStatus: 'idle',
  lastSynced: null,
  isAuthLoading: true,
  connectedDriveAccounts: JSON.parse(localStorage.getItem('base_connected_drives') || '[]'),

  setActiveWorkspaceId: (id) => {
    set({ activeWorkspaceId: id });
    if (id) {
      db.workspaces.update(id, { lastOpenedAt: Date.now() }).catch(err => {
        console.error('Failed to update workspace lastOpenedAt', err);
      });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),

  showCompanionMessage: (text, type = 'info', duration = 6000) => {
    set({ companionMessage: { text, type } });
    if (duration > 0) {
      setTimeout(() => {
        const current = get().companionMessage;
        if (current?.text === text) {
          set({ companionMessage: null });
        }
      }, duration);
    }
  },

  clearCompanionMessage: () => set({ companionMessage: null }),

  // ----------------------------------------------------
  // Workspace Mutations
  // ----------------------------------------------------
  createWorkspace: async (name, description) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const workspace: Workspace = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now
    };
    await db.workspaces.add(workspace);
    get().showCompanionMessage(`Workspace "${name}" created.`, 'success');
    get().triggerSync();
    return id;
  },

  updateWorkspace: async (id, updates) => {
    await db.workspaces.update(id, { ...updates, updatedAt: Date.now() });
    get().triggerSync();
  },

  deleteWorkspace: async (id) => {
    await db.transaction('rw', [db.workspaces, db.captures, db.tasks, db.resources], async () => {
      await db.workspaces.delete(id);
      await db.captures.where({ workspaceId: id }).delete();
      await db.tasks.where({ workspaceId: id }).delete();
      await db.resources.where({ workspaceId: id }).delete();
    });
    set({ activeWorkspaceId: null });
    get().showCompanionMessage('Workspace deleted.', 'info');
    get().triggerSync();
  },

  // ----------------------------------------------------
  // Capture Mutations
  // ----------------------------------------------------
  createCapture: async ({ workspaceId, type, content, url, mediaPath }) => {
    const id = crypto.randomUUID();
    const capture: Capture = {
      id,
      workspaceId,
      type,
      content,
      url,
      mediaPath,
      createdAt: Date.now()
    };
    await db.captures.add(capture);

    // Also auto-create a resource if type is link or image
    if (type === 'link' && url) {
      await get().createResource({
        title: content || url,
        url,
        type: 'link',
        workspaceId
      });
    } else if (type === 'image' && mediaPath) {
      await get().createResource({
        title: content || 'Captured Image',
        url: mediaPath,
        type: 'image',
        workspaceId
      });
    }

    get().showCompanionMessage('Auto-saved. Future-you says thanks.', 'success');
    get().triggerSync();
  },

  updateCaptureWorkspace: async (id, workspaceId) => {
    await db.captures.update(id, { workspaceId });
    get().triggerSync();
  },

  deleteCapture: async (id) => {
    await db.captures.delete(id);
    get().triggerSync();
  },

  // ----------------------------------------------------
  // Task Mutations
  // ----------------------------------------------------
  createTask: async (title, workspaceId, dueDate) => {
    const id = crypto.randomUUID();
    // Default due date to Today if not specified
    const finalDueDate = dueDate || new Date().toISOString().split('T')[0];
    const task: Task = {
      id,
      workspaceId,
      title,
      completed: false,
      dueDate: finalDueDate,
      createdAt: Date.now()
    };
    await db.tasks.add(task);
    get().showCompanionMessage('Task added to list.', 'success');
    get().triggerSync();
  },

  toggleTask: async (id) => {
    const task = await db.tasks.get(id);
    if (task) {
      const completed = !task.completed;
      await db.tasks.update(id, {
        completed,
        completedAt: completed ? Date.now() : undefined
      });
      if (completed) {
        get().showCompanionMessage("Task finished. One step closer!", 'success');
      }
      get().triggerSync();
    }
  },

  deleteTask: async (id) => {
    await db.tasks.delete(id);
    get().triggerSync();
  },

  // ----------------------------------------------------
  // Resource Mutations
  // ----------------------------------------------------
  createResource: async ({ title, url, type, workspaceId, extractedText }) => {
    const id = crypto.randomUUID();
    const resource: Resource = {
      id,
      workspaceId,
      title,
      url,
      type,
      pinned: false,
      createdAt: Date.now(),
      extractedText
    };
    await db.resources.add(resource);
    get().triggerSync();
  },

  toggleResourcePin: async (id) => {
    const resource = await db.resources.get(id);
    if (resource) {
      await db.resources.update(id, { pinned: !resource.pinned });
      get().showCompanionMessage(
        resource.pinned ? 'Resource unpinned.' : 'Resource pinned to Home.',
        'info'
      );
      get().triggerSync();
    }
  },

  deleteResource: async (id) => {
    await db.resources.delete(id);
    get().triggerSync();
  },

  // ----------------------------------------------------
  // Auth & Cloud Sync Implementation
  // ----------------------------------------------------
  checkAuthStatus: async () => {
    set({ isAuthLoading: true });
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/status`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.isAuthenticated) {
        set({
          isAuthenticated: true,
          isMockAuth: data.isMock,
          user: data.user,
          isAuthLoading: false
        });
        // Run sync on successful login detection
        get().triggerSync();
      } else {
        set({ isAuthenticated: false, user: null, isAuthLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      // Fallback for offline mode or backend server down
      set({ isAuthenticated: false, isAuthLoading: false });
    }
  },

  login: async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/url`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to initialize login:', error);
      get().showCompanionMessage('Unable to connect to login server.', 'warning');
    }
  },

  loginWithEmail: async (email, password) => {
    set({ isAuthLoading: true });
    try {
      const deviceInfo = {
        deviceId: crypto.randomUUID(),
        name: navigator.userAgent.substring(0, 30),
        type: 'web',
        os: navigator.platform,
        unique_identifier: 'web-fingerprint-' + window.screen.width + 'x' + window.screen.height
      };

      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceInfo }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      set({
        isAuthenticated: true,
        isMockAuth: false,
        user: data.user,
        isAuthLoading: false
      });
      get().showCompanionMessage(`Welcome back, ${data.user?.name || 'user'}!`, 'success');
      get().triggerSync();
      return true;
    } catch (error: any) {
      console.error('Email login error:', error);
      set({ isAuthLoading: false });
      get().showCompanionMessage(error.message || 'Login failed', 'warning');
      return false;
    }
  },

  registerWithEmail: async (email, password, name) => {
    set({ isAuthLoading: true });
    try {
      const deviceInfo = {
        deviceId: crypto.randomUUID(),
        name: navigator.userAgent.substring(0, 30),
        type: 'web',
        os: navigator.platform,
        unique_identifier: 'web-fingerprint-' + window.screen.width + 'x' + window.screen.height
      };

      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, deviceInfo }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Automatically invalidate the automatic registration session cookie to require manual login
      try {
        await fetch(`${BACKEND_URL}/api/auth/logout`, { 
          method: 'POST',
          credentials: 'include'
        });
      } catch (err) {
        console.warn('Logout cleanup failed:', err);
      }

      set({
        isAuthenticated: false,
        user: null,
        isAuthLoading: false
      });
      get().showCompanionMessage(`Account created successfully!`, 'success');
      return true;
    } catch (error: any) {
      console.error('Email registration error:', error);
      set({ isAuthLoading: false });
      get().showCompanionMessage(error.message || 'Registration failed', 'warning');
      return false;
    }
  },

  registerWithGDrive: async (params) => {
    set({ isAuthLoading: true });
    try {
      const deviceInfo = {
        deviceId: crypto.randomUUID(),
        name: navigator.userAgent.substring(0, 30),
        type: 'web',
        os: navigator.platform,
        unique_identifier: 'web-fingerprint-' + window.screen.width + 'x' + window.screen.height
      };

      const response = await fetch(`${BACKEND_URL}/api/auth/register-gdrive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, deviceInfo }),
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      set({ isAuthLoading: false });
      get().showCompanionMessage('Account registered successfully with Google Drive!', 'success');
      return true;
    } catch (error: any) {
      console.error('GDrive registration error:', error);
      set({ isAuthLoading: false });
      get().showCompanionMessage(error.message || 'Registration failed', 'warning');
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, { 
        method: 'POST',
        credentials: 'include'
      });
      set({ isAuthenticated: false, user: null });
      get().showCompanionMessage('Logged out. Your data remains safe locally.', 'info');
    } catch (error) {
      console.error('Failed to log out:', error);
      // Hard logout locally
      set({ isAuthenticated: false, user: null });
    }
  },

  triggerSync: async () => {
    const { isAuthenticated, syncStatus } = get();
    if (!isAuthenticated || syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing' });

    try {
      // Gather all local database tables
      const workspaces = await db.workspaces.toArray();
      const captures = await db.captures.toArray();
      const tasks = await db.tasks.toArray();
      const resources = await db.resources.toArray();

      const dump = { workspaces, captures, tasks, resources };

      // Multi-Account sync selection
      const activeAccount = get().connectedDriveAccounts.find(acc => acc.isActive);
      const email = activeAccount ? activeAccount.email : undefined;

      const response = await fetch(`${BACKEND_URL}/api/sync/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dump,
          timestamp: Date.now(),
          email: email
        }),
        credentials: 'include'
      });

      if (response.ok) {
        set({ syncStatus: 'success', lastSynced: Date.now() });
        console.log('[Sync] Data successfully backed up to cloud.');
      } else {
        set({ syncStatus: 'error' });
      }
    } catch (error) {
      console.error('[Sync] Background sync error:', error);
      set({ syncStatus: 'error' });
    }
  },

  addDriveAccount: (email) => {
    const accounts = get().connectedDriveAccounts;
    if (accounts.some(acc => acc.email === email)) {
      get().showCompanionMessage('This Google account is already connected.', 'warning');
      return;
    }
    const newAccount: DriveAccount = {
      email,
      isActive: true,
      fileCount: Math.floor(Math.random() * 45) + 12,
      connectedAt: Date.now()
    };
    
    // Deactivate others to make this one the primary active sync target
    const updated = [...accounts.map(acc => ({ ...acc, isActive: false })), newAccount];
    localStorage.setItem('base_connected_drives', JSON.stringify(updated));
    set({ connectedDriveAccounts: updated });
    get().showCompanionMessage(`Connected Drive: ${email}`, 'success');
  },
  
  removeDriveAccount: (email) => {
    const updated = get().connectedDriveAccounts.filter(acc => acc.email !== email);
    localStorage.setItem('base_connected_drives', JSON.stringify(updated));
    set({ connectedDriveAccounts: updated });
    get().showCompanionMessage('Account disconnected.', 'info');
  },
  
  toggleDriveAccountActive: (email) => {
    const updated = get().connectedDriveAccounts.map(acc => ({
      ...acc,
      isActive: acc.email === email ? !acc.isActive : acc.isActive
    }));
    localStorage.setItem('base_connected_drives', JSON.stringify(updated));
    set({ connectedDriveAccounts: updated });
  }
}));

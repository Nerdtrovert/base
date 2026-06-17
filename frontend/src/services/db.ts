import Dexie, { type Table } from 'dexie';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
}

export interface Capture {
  id: string;
  workspaceId: string | null; // null represents unorganized quick captures
  type: 'note' | 'link' | 'image' | 'idea';
  content: string; // The text content of the note/idea or title
  url?: string; // For links or images
  mediaPath?: string; // Local file path or base64 data URL
  createdAt: number;
}

export interface Task {
  id: string;
  workspaceId: string | null;
  title: string;
  completed: boolean;
  dueDate: string; // YYYY-MM-DD
  createdAt: number;
  completedAt?: number;
}

export interface Resource {
  id: string;
  workspaceId: string | null;
  title: string;
  url: string;
  type: 'link' | 'file' | 'drive' | 'pdf' | 'image';
  mimeType?: string;
  pinned: boolean;
  createdAt: number;
  extractedText?: string;
}

class BaseDatabase extends Dexie {
  workspaces!: Table<Workspace>;
  captures!: Table<Capture>;
  tasks!: Table<Task>;
  resources!: Table<Resource>;

  constructor() {
    super('BaseDatabase');
    this.version(1).stores({
      workspaces: 'id, name, createdAt, lastOpenedAt',
      captures: 'id, workspaceId, type, createdAt',
      tasks: 'id, workspaceId, completed, dueDate, createdAt',
      resources: 'id, workspaceId, type, pinned, createdAt'
    });
  }
}

export const db = new BaseDatabase();

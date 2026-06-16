import Fuse from 'fuse.js';
import { db } from '../services/db';

export interface SearchResult {
  id: string;
  type: 'workspace' | 'capture' | 'task' | 'resource';
  title: string;
  subtitle?: string;
  workspaceId: string | null;
  workspaceName?: string;
  url?: string;
  completed?: boolean;
  createdAt: number;
}

export async function searchEverything(query: string): Promise<SearchResult[]> {
  if (!query || query.trim() === '') return [];

  // 1. Fetch all datasets from IndexedDB
  const workspaces = await db.workspaces.toArray();
  const captures = await db.captures.toArray();
  const tasks = await db.tasks.toArray();
  const resources = await db.resources.toArray();

  // Create a map for fast workspace lookup
  const workspaceMap = new Map<string, string>();
  workspaces.forEach(w => workspaceMap.set(w.id, w.name));

  // 2. Normalize data into standard SearchResult shape
  const items: SearchResult[] = [];

  workspaces.forEach((w) => {
    items.push({
      id: w.id,
      type: 'workspace',
      title: w.name,
      subtitle: w.description || 'Workspace',
      workspaceId: w.id,
      createdAt: w.createdAt
    });
  });

  captures.forEach((c) => {
    const wsName = c.workspaceId ? workspaceMap.get(c.workspaceId) : undefined;
    items.push({
      id: c.id,
      type: 'capture',
      title: c.content,
      subtitle: `Capture • ${c.type.toUpperCase()}`,
      workspaceId: c.workspaceId,
      workspaceName: wsName,
      url: c.url,
      createdAt: c.createdAt
    });
  });

  tasks.forEach((t) => {
    const wsName = t.workspaceId ? workspaceMap.get(t.workspaceId) : undefined;
    items.push({
      id: t.id,
      type: 'task',
      title: t.title,
      subtitle: `Task • Due ${t.dueDate}${t.completed ? ' (Completed)' : ''}`,
      workspaceId: t.workspaceId,
      workspaceName: wsName,
      completed: t.completed,
      createdAt: t.createdAt
    });
  });

  resources.forEach((r) => {
    const wsName = r.workspaceId ? workspaceMap.get(r.workspaceId) : undefined;
    items.push({
      id: r.id,
      type: 'resource',
      title: r.title,
      subtitle: `Resource • ${r.type.toUpperCase()}`,
      workspaceId: r.workspaceId,
      workspaceName: wsName,
      url: r.url,
      createdAt: r.createdAt
    });
  });

  // 3. Configure and run Fuse.js
  const options = {
    keys: ['title', 'subtitle', 'workspaceName'],
    threshold: 0.3,
    ignoreLocation: true
  };

  const fuse = new Fuse(items, options);
  const results = fuse.search(query);

  return results.map(r => r.item);
}

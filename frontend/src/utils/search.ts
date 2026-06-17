import Fuse from 'fuse.js';
import { db } from '../services/db';

export interface SearchResult {
  id: string;
  type: 'workspace' | 'capture' | 'task' | 'resource' | 'gdrive';
  title: string;
  subtitle?: string;
  workspaceId: string | null;
  workspaceName?: string;
  url?: string;
  completed?: boolean;
  createdAt: number;
  gdriveAccount?: string;
  snippet?: string;
}

const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5001';
  const hostname = window.location.hostname;
  if (hostname.includes('devtunnels.ms')) {
    return window.location.origin.replace('-5173', '-5001');
  }
  return `http://${hostname}:5001`;
};

const BACKEND_URL = getBackendUrl();

export async function searchEverything(query: string, activeDrives: string[] = []): Promise<SearchResult[]> {
  if (!query || query.trim() === '') return [];

  // 1. Fetch all local datasets from IndexedDB
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
      createdAt: r.createdAt,
      extractedText: r.extractedText
    } as any);
  });

  // 3. Configure and run Fuse.js on local data with weight tuning
  const options = {
    keys: [
      { name: 'title', weight: 0.8 },
      { name: 'subtitle', weight: 0.3 },
      { name: 'workspaceName', weight: 0.3 },
      { name: 'extractedText', weight: 0.2 }
    ],
    threshold: 0.4,
    ignoreLocation: true
  };

  const fuse = new Fuse(items, options);
  const results = fuse.search(query);
  
  const getSnippet = (text: string, q: string, len: number = 60): string => {
    if (!text || !q) return '';
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return '';
    const start = Math.max(0, idx - len / 2);
    const end = Math.min(text.length, start + len);
    let snippet = text.substring(start, end).replace(/\r?\n|\r/g, " ");
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  };

  const localResults = results.map(r => {
    const item = { ...r.item };
    if (r.item.type === 'resource' && (r.item as any).extractedText) {
      const snippet = getSnippet((r.item as any).extractedText, query);
      if (snippet) {
        item.snippet = snippet;
      }
    }
    return item;
  });

  // 4. Query connected GDrive accounts in parallel
  if (activeDrives.length > 0) {
    try {
      const drivePromises = activeDrives.map(async (email) => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/sync/drive/search?query=${encodeURIComponent(query)}&email=${encodeURIComponent(email)}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            return (data.files || []).map((file: any) => ({
              id: file.id,
              type: 'gdrive' as const,
              title: file.name,
              subtitle: `Google Drive File (${file.size}) • ${email}`,
              workspaceId: null,
              url: file.webViewLink,
              createdAt: Date.now(),
              gdriveAccount: email
            }));
          }
        } catch (e) {
          console.error('[GDrive Search] Error querying account:', email, e);
        }
        return [];
      });

      const driveResultsArrays = await Promise.all(drivePromises);
      const driveResults = driveResultsArrays.flat();
      
      return [...localResults, ...driveResults];
    } catch (err) {
      console.error('[GDrive Search] Search merge failed:', err);
    }
  }

  return localResults;
}

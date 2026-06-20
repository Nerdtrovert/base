import { db } from '../services/db';
import { extractTextFromPdf } from './pdfParser';
import { BACKEND_URL } from '../lib/api';

export const runSmartCacheCleanup = async () => {
  try {
    const policy = localStorage.getItem('base_storage_policy') || 'smart-cache';
    if (policy === 'metadata-only') {
      const resources = await db.resources.toArray();
      const toClear = resources.filter(r => r.extractedText);
      for (const r of toClear) {
        await db.resources.update(r.id, { extractedText: undefined } as any);
      }
      return;
    }
    
    if (policy === 'full-index') {
      return;
    }

    const maxBytes = (Number(localStorage.getItem('base_max_cache_size') || '100')) * 1024 * 1024;
    const maxCount = Number(localStorage.getItem('base_max_pdf_count') || '20');

    const resources = await db.resources.toArray();
    const indexed = resources.filter(r => r.extractedText);

    // Sort by access time / creation time (oldest first)
    const sorted = [...indexed].sort((a, b) => {
      const aTime = (a as any).lastOpenedAt || a.createdAt || 0;
      const bTime = (b as any).lastOpenedAt || b.createdAt || 0;
      return aTime - bTime;
    });

    let currentSize = indexed.reduce((acc, r) => acc + (r.extractedText?.length || 0), 0) * 2; // UTF-16 is 2 bytes/char
    let currentCount = indexed.length;

    for (const r of sorted) {
      if (currentSize <= maxBytes && currentCount <= maxCount) {
        break;
      }
      await db.resources.update(r.id, { extractedText: undefined } as any);
      currentSize -= (r.extractedText?.length || 0) * 2;
      currentCount--;
    }
  } catch (err) {
    console.error('[Cache Cleanup] Failed to run smart cache eviction:', err);
  }
};

export const indexResourceText = async (id: string, text: string) => {
  try {
    const policy = localStorage.getItem('base_storage_policy') || 'smart-cache';
    if (policy === 'metadata-only') {
      // Under metadata-only, we do not cache the text
      return;
    }

    await db.resources.update(id, {
      extractedText: text,
      lastOpenedAt: Date.now()
    } as any);

    await runSmartCacheCleanup();
  } catch (err) {
    console.error('[Smart Cache] Failed to index resource text:', err);
  }
};

export const getCacheStatistics = async () => {
  const resources = await db.resources.toArray();
  const indexed = resources.filter(r => r.extractedText);
  
  const totalCharacters = indexed.reduce((acc, r) => acc + (r.extractedText?.length || 0), 0);
  const sizeInBytes = totalCharacters * 2;
  const sizeInMB = parseFloat((sizeInBytes / (1024 * 1024)).toFixed(1));

  return {
    fileCount: indexed.length,
    sizeMB: sizeInMB,
    policy: localStorage.getItem('base_storage_policy') || 'smart-cache',
    maxMB: Number(localStorage.getItem('base_max_cache_size') || '100'),
    maxPDFs: Number(localStorage.getItem('base_max_pdf_count') || '20')
  };
};

export const clearPdfCache = async () => {
  try {
    const resources = await db.resources.toArray();
    const toClear = resources.filter(r => r.extractedText);
    for (const r of toClear) {
      await db.resources.update(r.id, { extractedText: undefined } as any);
    }
  } catch (err) {
    console.error('[Smart Cache] Failed to clear cache:', err);
  }
};

export const openAndIndexResource = async (resourceId: string) => {
  try {
    // 1. Fetch resource from DB
    const res = await db.resources.get(resourceId);
    if (!res) return;

    // 2. Update lastOpenedAt
    const now = Date.now();
    await db.resources.update(resourceId, { lastOpenedAt: now } as any);

    // 3. If policy is metadata-only, do not extract text
    const policy = localStorage.getItem('base_storage_policy') || 'smart-cache';
    if (policy === 'metadata-only') {
      return;
    }

    // 4. If it's a PDF and doesn't have extractedText, extract and index
    const isPdf = res.type === 'pdf' || res.url?.toLowerCase().endsWith('.pdf') || res.mimeType === 'application/pdf';
    
    if (isPdf && !res.extractedText) {
      console.log(`[Smart Cache] Lazily extracting text for resource: ${res.title}`);
      
      let arrayBuffer: ArrayBuffer;

      // Check if it is a Google Drive file
      const driveIdMatch = res.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || res.url.match(/id=([a-zA-Z0-9_-]+)/);
      if (driveIdMatch && driveIdMatch[1]) {
        const fileId = driveIdMatch[1];
        // Fetch via download proxy
        const response = await fetch(`${BACKEND_URL}/api/sync/drive/download/${fileId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to download from Drive proxy: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      } else {
        // Direct fetch
        const response = await fetch(res.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch direct URL: ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      }

      const text = await extractTextFromPdf(arrayBuffer);
      if (text) {
        await indexResourceText(resourceId, text);
        console.log(`[Smart Cache] Successfully extracted and indexed ${text.length} characters.`);
      }
    }
  } catch (err) {
    console.warn('[Smart Cache] Lazy extraction skipped/failed:', err);
  }
};

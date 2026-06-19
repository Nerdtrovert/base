import { useBaseStore } from '../store/useBaseStore';
import { extractTextFromPdf } from './pdfParser';

/**
 * Indexes a single local File object, extracts its text (if it's a PDF or text file),
 * and creates a Resource entry in the store/IndexedDB.
 */
export const indexLocalFile = async (file: File, relativePath: string) => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let type: 'pdf' | 'image' | 'file' = 'file';
  let mimeType = file.type || 'application/octet-stream';
  let extractedText = '';

  if (ext === 'pdf') {
    type = 'pdf';
    mimeType = 'application/pdf';
    try {
      const buffer = await file.arrayBuffer();
      extractedText = await extractTextFromPdf(buffer);
    } catch (e) {
      console.warn(`[Index] Failed to extract text from PDF: ${file.name}`, e);
    }
  } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    type = 'image';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else mimeType = `image/${ext}`;
  } else if (['txt', 'md', 'json', 'js', 'ts', 'html', 'css'].includes(ext)) {
    try {
      extractedText = await file.text();
      // Cap text to avoid huge DB records
      if (extractedText.length > 50000) {
        extractedText = extractedText.substring(0, 50000) + '\n... [truncated]';
      }
    } catch (e) {
      console.warn(`[Index] Failed to read text file: ${file.name}`, e);
    }
  }

  // Create the resource using base store action (which triggers sync event)
  await useBaseStore.getState().createResource({
    title: file.name,
    url: `local-file://${encodeURIComponent(relativePath)}`,
    type,
    workspaceId: null, // Will be auto-resolved based on proximity/tags
    extractedText: extractedText || undefined,
    mimeType
  });
};

/**
 * Traverses a FileSystemDirectoryHandle recursively and indexes all files inside.
 */
export const traverseAndIndexDirectory = async (
  dirHandle: any,
  onProgress?: (filename: string) => void,
  currentPath = ''
) => {
  for await (const entry of dirHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      try {
        const file = await entry.getFile();
        if (onProgress) onProgress(file.name);
        await indexLocalFile(file, entryPath);
      } catch (err) {
        console.warn(`Failed to read file ${entry.name}:`, err);
      }
    } else if (entry.kind === 'directory') {
      await traverseAndIndexDirectory(entry, onProgress, entryPath);
    }
  }
};

/**
 * Indexes a FileList (flat files selected via mobile fallback input).
 */
export const indexFileList = async (
  files: FileList,
  onProgress?: (filename: string) => void
) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = file.webkitRelativePath || file.name;
    if (onProgress) onProgress(file.name);
    await indexLocalFile(file, path);
  }
};

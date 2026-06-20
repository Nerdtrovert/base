import React, { useState, useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Shield, WifiOff, AlertCircle, HardDrive, RefreshCw, Download, Upload, Trash2 } from 'lucide-react';
import { getCacheStatistics, clearPdfCache, runSmartCacheCleanup } from '../utils/smartCache';
import { Button } from './ui/button';

export const StorageHealth: React.FC = () => {
  const { syncStatus, lastSynced, connectedDriveAccounts, triggerSync, showCompanionMessage } = useBaseStore();
  const [timeAgo, setTimeAgo] = useState('Never');
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true);
  
  const [cacheStats, setCacheStats] = useState({
    fileCount: 0,
    sizeMB: 0,
    policy: 'smart-cache',
    maxMB: 100,
    maxPDFs: 20
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadStats = async () => {
    const stats = await getCacheStatistics();
    setCacheStats(stats);
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch reactive counts from IndexedDB
  const pendingChanges = useLiveQuery(() => 
    db.syncQueue.where('status').anyOf(['pending', 'failed', 'syncing']).count()
  ) ?? 0;

  const ksCount = useLiveQuery(() => db.knowledgeSources.count()) ?? 0;

  const activeAccount = connectedDriveAccounts?.find(a => a.isActive);
  const isSyncEnabled = !!activeAccount;

  // Format last synced time into readable formats (e.g. "5 minutes ago", "Yesterday at 8:42 PM")
  const formatBackupTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);

    if (secs < 60) return 'Just now';
    if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
    if (hours < 24) {
      // Check if it was yesterday
      const lastSyncedDate = new Date(timestamp);
      const today = new Date();
      if (lastSyncedDate.getDate() !== today.getDate()) {
        return `Yesterday at ${lastSyncedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      }
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  useEffect(() => {
    const updateTime = () => {
      setTimeAgo(formatBackupTime(lastSynced));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [lastSynced]);

  const handleManualSync = async () => {
    if (!isOnline) {
      showCompanionMessage('You are offline. Cannot sync.', 'warning');
      return;
    }
    showCompanionMessage('Starting sync...', 'info');
    await triggerSync();
  };

  const handlePolicyChange = async (newPolicy: string) => {
    localStorage.setItem('base_storage_policy', newPolicy);
    await runSmartCacheCleanup();
    await loadStats();
    showCompanionMessage(`Storage policy updated to: ${newPolicy}`, 'info');
  };

  const handleMaxMBChange = async (val: number) => {
    localStorage.setItem('base_max_cache_size', val.toString());
    await runSmartCacheCleanup();
    await loadStats();
  };

  const handleMaxPDFsChange = async (val: number) => {
    localStorage.setItem('base_max_pdf_count', val.toString());
    await runSmartCacheCleanup();
    await loadStats();
  };

  const handleExport = async () => {
    try {
      const data = {
        workspaces: await db.workspaces.toArray(),
        captures: await db.captures.toArray(),
        tasks: await db.tasks.toArray(),
        resources: await db.resources.toArray(),
        knowledgeSources: await db.knowledgeSources.toArray(),
        syncQueue: await db.syncQueue.toArray()
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `base-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showCompanionMessage('Local JSON backup exported.', 'success');
    } catch (err: any) {
      console.error(err);
      showCompanionMessage('Failed to export backup.', 'warning');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      'Are you sure you want to restore this backup? This will overwrite all your current local data.'
    );
    if (!confirmed) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid backup file structure.');
        }

        await db.transaction('rw', [db.workspaces, db.captures, db.tasks, db.resources, db.knowledgeSources, db.syncQueue], async () => {
          if (data.workspaces) {
            await db.workspaces.clear();
            await db.workspaces.bulkAdd(data.workspaces);
          }
          if (data.captures) {
            await db.captures.clear();
            await db.captures.bulkAdd(data.captures);
          }
          if (data.tasks) {
            await db.tasks.clear();
            await db.tasks.bulkAdd(data.tasks);
          }
          if (data.resources) {
            await db.resources.clear();
            await db.resources.bulkAdd(data.resources);
          }
          if (data.knowledgeSources) {
            await db.knowledgeSources.clear();
            await db.knowledgeSources.bulkAdd(data.knowledgeSources);
          }
          if (data.syncQueue) {
            await db.syncQueue.clear();
            await db.syncQueue.bulkAdd(data.syncQueue);
          }
        });

        showCompanionMessage('JSON backup restored successfully.', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        console.error(err);
        showCompanionMessage(err.message || 'Failed to restore data.', 'warning');
      }
    };
    reader.readAsText(file);
  };

  // Determine storage status based on network, enableSync status, and sync errors
  // 🟢 Protected: online, has synced account, no error
  // 🟡 Local Only: offline OR sync is not enabled/connected
  // 🔴 Attention: online, but syncStatus is error (e.g., Google API failure)
  let status: 'protected' | 'local-only' | 'attention' = 'protected';

  if (!isOnline || !isSyncEnabled) {
    status = 'local-only';
  } else if (syncStatus === 'error') {
    status = 'attention';
  } else {
    status = 'protected';
  }

  return (
    <div className="bg-card-bg/40 dark:bg-card-bg/10 border border-border-color rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all duration-300">
      
      {/* 🟢 Protected state */}
      {status === 'protected' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                Protected
              </span>
            </div>
            <Shield className="w-4 h-4 text-emerald-500" />
          </div>

          <div className="space-y-3 font-mono text-xs pl-1 border-l border-emerald-500/30">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Local Workspace</span>
              <span className="text-emerald-500 font-semibold">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Cloud Backup</span>
              <span className="text-text-primary font-semibold">{timeAgo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Pending Changes</span>
              <span className="text-text-primary font-semibold">{pendingChanges}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Knowledge Sources</span>
              <span className="text-text-primary font-semibold">{ksCount} Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 Local Only state */}
      {status === 'local-only' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
                Local Only
              </span>
            </div>
            <WifiOff className="w-4 h-4 text-amber-500" />
          </div>

          <p className="text-xs text-text-primary font-medium pl-1">
            Everything is saved locally.
          </p>

          <div className="space-y-3 font-mono text-xs pl-1 border-l border-amber-500/30">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Pending Changes</span>
              <span className="text-text-primary font-semibold">{pendingChanges}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Last Cloud Backup</span>
              <span className="text-text-primary font-semibold">{timeAgo}</span>
            </div>
          </div>

          <p className="text-[10px] text-text-muted leading-relaxed italic pl-1">
            Changes will be protected automatically when a connection becomes available.
          </p>
        </div>
      )}

      {/* 🔴 Attention state */}
      {status === 'attention' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600 dark:text-rose-400">
                Attention
              </span>
            </div>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>

          <div className="text-xs text-text-secondary pl-1 space-y-1">
            <p className="text-text-primary font-semibold">Local data is safe.</p>
            <p>Cloud backup could not be completed.</p>
          </div>

          <div className="space-y-3 font-mono text-xs pl-1 border-l border-rose-500/30">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Pending Changes</span>
              <span className="text-text-primary font-semibold">{pendingChanges}</span>
            </div>
          </div>

          <p className="text-[10px] text-text-muted leading-relaxed italic pl-1">
            Retrying automatically...
          </p>
        </div>
      )}

      {/* Manual Sync Trigger Button (if sync is enabled) */}
      {isSyncEnabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={syncStatus === 'syncing'}
          className="w-full gap-1.5 border-border-color text-[11px] font-medium h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-text-secondary ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
          <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
        </Button>
      )}

      {/* 🚀 Smart Cache & Search Settings Panel */}
      <div className="border-t border-border-color/60 pt-4 mt-2 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-accent" />
            <span>Search Cache</span>
          </span>
          <span className="text-[10px] font-mono text-text-secondary">
            {cacheStats.fileCount} {cacheStats.fileCount === 1 ? 'file' : 'files'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-text-secondary">Cache Usage</span>
            <span className="text-text-primary font-semibold">
              {cacheStats.sizeMB} MB / {cacheStats.maxMB} MB
            </span>
          </div>
          <div className="h-2 w-full bg-bg-app border border-border-color rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${Math.min(100, (cacheStats.sizeMB / cacheStats.maxMB) * 100)}%` }}
            />
          </div>
        </div>

        {/* Storage Policy Selector */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-secondary block">
            Storage Policy
          </label>
          <div className="grid grid-cols-3 gap-1 bg-bg-app p-0.5 border border-border-color rounded-xl">
            {[
              { id: 'smart-cache', label: 'Smart' },
              { id: 'metadata-only', label: 'Meta Only' },
              { id: 'full-index', label: 'Full' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePolicyChange(p.id)}
                className={`py-1 text-[10px] font-medium rounded-lg transition-colors cursor-pointer text-center ${
                  cacheStats.policy === p.id
                    ? 'bg-card-bg border border-border-color shadow-sm text-text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-text-muted leading-relaxed italic">
            {cacheStats.policy === 'smart-cache' && 'LRU cache (evicts text extraction of old PDFs while keeping metadata intact).'}
            {cacheStats.policy === 'metadata-only' && 'No text extracted/cached locally. Searches metadata only.'}
            {cacheStats.policy === 'full-index' && 'Extracted PDF text is cached permanently without eviction.'}
          </p>
        </div>

        {/* Conditional Smart Cache Settings */}
        {cacheStats.policy === 'smart-cache' && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-bg-app/40 border border-border-color/60 rounded-2xl">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary block">
                Max Size (MB)
              </label>
              <select
                value={cacheStats.maxMB}
                onChange={(e) => handleMaxMBChange(Number(e.target.value))}
                className="w-full bg-bg-app border border-border-color text-xs rounded-lg py-1 px-1.5 text-text-primary focus:border-accent outline-none"
              >
                <option value={10}>10 MB</option>
                <option value={30}>30 MB</option>
                <option value={50}>50 MB</option>
                <option value={100}>100 MB</option>
                <option value={200}>200 MB</option>
                <option value={500}>500 MB</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary block">
                Max PDF Count
              </label>
              <select
                value={cacheStats.maxPDFs}
                onChange={(e) => handleMaxPDFsChange(Number(e.target.value))}
                className="w-full bg-bg-app border border-border-color text-xs rounded-lg py-1 px-1.5 text-text-primary focus:border-accent outline-none"
              >
                <option value={5}>5 PDFs</option>
                <option value={10}>10 PDFs</option>
                <option value={20}>20 PDFs</option>
                <option value={50}>50 PDFs</option>
                <option value={100}>100 PDFs</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              const confirmed = window.confirm('Clear all cached PDF text? This will not delete your files or metadata.');
              if (confirmed) {
                await clearPdfCache();
                await loadStats();
                showCompanionMessage('PDF search cache cleared.', 'success');
              }
            }}
            disabled={cacheStats.fileCount === 0}
            className="flex-grow gap-1.5 border-border-color text-xs text-rose-500 hover:bg-rose-500/5 hover:text-rose-600 h-8"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </Button>
        </div>
      </div>

      {/* 💾 Local Database JSON Backup & Restore */}
      <div className="border-t border-border-color/60 pt-4 space-y-3">
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5 text-accent" />
          <span>Local Backup</span>
        </span>

        <p className="text-[10px] text-text-secondary leading-normal">
          Export or restore your entire offline Base database (focus modes, tasks, captures, mounted paths) via JSON.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="w-full gap-1.5 border-border-color text-[11px] font-medium h-8"
          >
            <Download className="w-3.5 h-3.5 text-text-secondary" />
            <span>Export JSON</span>
          </Button>

          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Select a backup JSON file to import"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-border-color text-[11px] font-medium h-8 pointer-events-none"
            >
              <Upload className="w-3.5 h-3.5 text-text-secondary" />
              <span>Import JSON</span>
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Shield, WifiOff, AlertCircle } from 'lucide-react';

export const StorageHealth: React.FC = () => {
  const { syncStatus, lastSynced, connectedDriveAccounts } = useBaseStore();
  const [timeAgo, setTimeAgo] = useState('Never');
  const [isOnline, setIsOnline] = useState(() => typeof window !== 'undefined' ? navigator.onLine : true);

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

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { HardDrive, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

export const StorageHealth: React.FC = () => {
  const { syncStatus, lastSynced, connectedDriveAccounts, triggerSync } = useBaseStore();
  const [timeAgo, setTimeAgo] = useState('Never');

  const activeAccount = connectedDriveAccounts?.find(a => a.isActive);
  const isSyncEnabled = !!activeAccount;

  // Determine current state
  let status: 'healthy' | 'local-only' | 'syncing' | 'error' = 'local-only';
  if (!isSyncEnabled) {
    status = 'local-only';
  } else if (syncStatus === 'syncing') {
    status = 'syncing';
  } else if (syncStatus === 'error') {
    status = 'error';
  } else {
    status = 'healthy';
  }

  // Update time-ago dynamically
  useEffect(() => {
    const updateTime = () => {
      if (!lastSynced) {
        setTimeAgo('Never');
        return;
      }
      const diff = Date.now() - lastSynced;
      const secs = Math.floor(diff / 1000);
      const mins = Math.floor(secs / 60);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);

      if (secs < 60) {
        setTimeAgo('Just now');
      } else if (mins < 60) {
        setTimeAgo(`${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`);
      } else if (hours < 24) {
        setTimeAgo(`${hours} ${hours === 1 ? 'hour' : 'hours'} ago`);
      } else {
        setTimeAgo(`${days} ${days === 1 ? 'day' : 'days'} ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [lastSynced]);

  const handleManualBackup = async () => {
    if (isSyncEnabled && syncStatus !== 'syncing') {
      await triggerSync();
    }
  };

  return (
    <div className="bg-card-bg/40 dark:bg-card-bg/10 border border-border-color rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all duration-300">
      {/* Header / State Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase select-none">
          <HardDrive className="w-4 h-4 text-accent" />
          <span>Storage Health</span>
        </div>
        
        {isSyncEnabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleManualBackup}
            disabled={syncStatus === 'syncing'}
            className="h-7 w-7 rounded-lg text-text-secondary hover:text-accent disabled:opacity-50 cursor-pointer"
            title="Backup database snapshot now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-accent' : ''}`} />
          </Button>
        )}
      </div>

      {/* States Renderer */}
      {status === 'healthy' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Protected</span>
          </div>

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium">
            <p className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span> <span className="text-text-primary">Encrypted locally</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span> <span className="text-text-primary">Backed up to your Drive</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span> <span className="text-text-primary">Only you control access</span>
            </p>
            <p className="text-[10px] text-text-muted mt-1">
              Last backup checked {timeAgo}
            </p>
          </div>
        </div>
      )}

      {status === 'local-only' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 w-fit">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold uppercase tracking-wider">Local Only</span>
          </div>

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed">
            <p className="text-text-primary">Encrypted locally</p>
            <p>Your files stay on this device until you connect backup.</p>
            <p className="text-text-muted text-[10px]">Only you control access right now.</p>
          </div>
        </div>
      )}

      {status === 'syncing' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider animate-pulse">Syncing</span>
          </div>

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed">
            <p className="font-semibold text-text-primary">Encrypted locally</p>
            <p>Backing up to your Drive in the background...</p>
            <p className="text-text-muted text-[10px]">Only you control access while this finishes.</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">Attention</span>
          </div>

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed">
            <p className="font-semibold text-rose-600 dark:text-rose-400">Unable to reach Google Drive.</p>
            <p className="text-text-primary">Encrypted locally</p>
            <p>Local data is still safe, and backup will retry automatically.</p>
            <p className="text-[10px] text-text-muted mt-1">Only you control access to what is already on this device.</p>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { HardDrive, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { db } from '../services/db';

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

  const handleDownloadLocalBackup = async () => {
    try {
      const workspaces = await db.workspaces.toArray();
      const captures = await db.captures.toArray();
      const tasks = await db.tasks.toArray();
      const resources = await db.resources.toArray();
      const knowledgeSources = await db.knowledgeSources.toArray();

      const backupData = {
        version: 1,
        timestamp: Date.now(),
        data: {
          workspaces,
          captures,
          tasks,
          resources,
          knowledgeSources
        }
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `base_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      useBaseStore.getState().showCompanionMessage('Local database backup downloaded successfully!', 'success');
    } catch (e) {
      console.error('Failed to export local database backup:', e);
      useBaseStore.getState().showCompanionMessage('Failed to download local backup.', 'warning');
    }
  };

  const handleRestoreLocalBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        if (!backupData.data || !backupData.version) {
          throw new Error('Invalid backup file format');
        }

        const data = backupData.data;

        await db.transaction('rw', [db.workspaces, db.captures, db.tasks, db.resources, db.knowledgeSources], async () => {
          await db.workspaces.clear();
          await db.captures.clear();
          await db.tasks.clear();
          await db.resources.clear();
          await db.knowledgeSources.clear();

          if (data.workspaces) await db.workspaces.bulkAdd(data.workspaces);
          if (data.captures) await db.captures.bulkAdd(data.captures);
          if (data.tasks) await db.tasks.bulkAdd(data.tasks);
          if (data.resources) await db.resources.bulkAdd(data.resources);
          if (data.knowledgeSources) await db.knowledgeSources.bulkAdd(data.knowledgeSources);
        });

        useBaseStore.getState().showCompanionMessage('Local database backup restored successfully!', 'success');
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err) {
        console.error('Failed to restore local backup:', err);
        useBaseStore.getState().showCompanionMessage('Failed to restore backup: Invalid file.', 'warning');
      }
    };
    reader.readAsText(file);
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

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed font-normal">
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

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed font-normal">
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

          <div className="space-y-1.5 pl-1.5 border-l border-border-color text-xs text-text-secondary font-medium leading-relaxed font-normal">
            <p className="font-semibold text-rose-600 dark:text-rose-400">Unable to reach Google Drive.</p>
            <p className="text-text-primary">Encrypted locally</p>
            <p>Local data is still safe, and backup will retry automatically.</p>
            <p className="text-[10px] text-text-muted mt-1">Only you control access to what is already on this device.</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border-color/50">
        {isSyncEnabled && (
          <Button
            onClick={handleManualBackup}
            disabled={syncStatus === 'syncing'}
            className="w-full h-8 text-[11px] font-semibold bg-accent hover:bg-accent/90 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
            <span>{syncStatus === 'syncing' ? 'Backing up...' : 'Backup to Cloud Now'}</span>
          </Button>
        )}
        
        <div className="flex gap-2">
          <Button
            onClick={handleDownloadLocalBackup}
            variant="outline"
            className="flex-1 h-8 text-[10px] font-semibold border-border-color hover:border-accent text-text-secondary flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <HardDrive className="w-3 h-3 text-accent animate-pulse" />
            <span>Download Backup</span>
          </Button>

          <div className="relative flex-1">
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreLocalBackup}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Restore local backup file"
            />
            <Button
              variant="outline"
              className="w-full h-8 text-[10px] font-semibold border-border-color hover:border-accent text-text-secondary flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3 h-3 text-accent" />
              <span>Restore Backup</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

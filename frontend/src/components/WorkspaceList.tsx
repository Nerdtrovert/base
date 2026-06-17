import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { Folder, FolderPlus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export const WorkspaceList: React.FC = () => {
  const { setActiveWorkspaceId, createWorkspace, deleteWorkspace } = useBaseStore();
  const navigate = useNavigate();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');

  // Fetch workspaces sorted by lastOpenedAt descending
  const workspaces = useLiveQuery(() => db.workspaces.toArray()) || [];
  const sortedWorkspaces = [...workspaces].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

  const formatLastOpened = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleOpenWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    navigate(`/workspace/${id}`);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    const id = await createWorkspace(newWsName.trim(), newWsDesc.trim() || undefined);
    setNewWsName('');
    setNewWsDesc('');
    setShowAddForm(false);
    handleOpenWorkspace(id);
  };

  return (
    <div className="pb-6 border-b border-border-color space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
          <Folder className="w-4 h-4 text-accent" />
          <span>Workspaces</span>
        </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowAddForm(!showAddForm)}
            className="h-8 w-8 text-accent"
            title="Create Workspace"
          >
            <FolderPlus className="w-4 h-4" />
          </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.form 
            onSubmit={handleCreateWorkspace}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 p-3 bg-bg-app border border-border-color rounded-[28px] overflow-hidden"
          >
            <div>
              <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">Workspace Name</label>
              <Input
                placeholder="CS-101, Personal Diary, etc."
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="h-8 bg-card-bg text-xs rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text-secondary uppercase mb-1">Description (Optional)</label>
              <Input
                placeholder="What is this workspace about?"
                value={newWsDesc}
                onChange={(e) => setNewWsDesc(e.target.value)}
                className="h-8 bg-card-bg text-xs rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2.5 rounded-lg"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-7 px-3 rounded-lg"
              >
                Create
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {sortedWorkspaces.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-secondary italic">
          No workspaces yet. Create one to begin organizing.
        </div>
      ) : (
        <motion.div className="space-y-1.5 max-h-56 overflow-y-auto pr-1" layout>
          <AnimatePresence initial={false}>
            {sortedWorkspaces.map(ws => (
              <motion.div
                key={ws.id}
                layout
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between group p-2 rounded-[28px] hover:bg-accent-light/25 cursor-pointer transition-colors"
                onClick={() => handleOpenWorkspace(ws.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="p-1.5 rounded-xl bg-accent-light text-accent flex-shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-text-primary truncate">
                      {ws.name}
                    </h4>
                    {ws.description && (
                      <p className="text-xs text-text-secondary truncate max-w-[180px]">
                        {ws.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-secondary font-mono mr-1">
                    {formatLastOpened(ws.lastOpenedAt)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                    className="h-7 w-7 p-0 text-text-secondary hover:text-rose-500 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

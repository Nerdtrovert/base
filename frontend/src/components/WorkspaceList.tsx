import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { Folder, FolderPlus, ArrowRight, Clock, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
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

  // Find the last opened workspace for the "Continue Working" card
  const lastOpenedWorkspace = sortedWorkspaces[0];

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
    <div className="space-y-6">
      {/* 1. Continue Working Card */}
      {lastOpenedWorkspace && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />
            <CardContent className="p-5 flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-accent tracking-wider uppercase block">
                  ▶ CONTINUE WORKING
                </span>
                <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                  {lastOpenedWorkspace.name}
                </h3>
                {lastOpenedWorkspace.description && (
                  <p className="text-xs text-text-secondary line-clamp-1 max-w-md">
                    {lastOpenedWorkspace.description}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last active {formatLastOpened(lastOpenedWorkspace.lastOpenedAt)}</span>
                </div>
              </div>

              <Button
                onClick={() => handleOpenWorkspace(lastOpenedWorkspace.id)}
                size="sm"
                className="cursor-pointer gap-1.5"
              >
                <span>Resume</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 2. Workspace Nodes Section */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold tracking-wider text-text-secondary uppercase">
                Workspaces
              </h3>
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

          {/* Add Workspace Form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form 
                onSubmit={handleCreateWorkspace} 
                className="p-3 bg-bg-app border border-border-color rounded-xl space-y-3"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Workspace Name</label>
                  <Input
                    placeholder="e.g. Design Studio, Calculus III"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Description (Optional)</label>
                  <Input
                    placeholder="e.g. Semester project, assignments and resources"
                    value={newWsDesc}
                    onChange={(e) => setNewWsDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                  >
                    Create
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Workspaces List with Framer Motion animation */}
          {sortedWorkspaces.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary italic">
              No active workspaces yet. Let's create your first workspace subject node.
            </div>
          ) : (
            <motion.div className="space-y-1.5" layout>
              <AnimatePresence initial={false}>
                {sortedWorkspaces.map(ws => (
                  <motion.div
                    key={ws.id}
                    className="flex items-center justify-between group p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-border-color transition-all"
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => handleOpenWorkspace(ws.id)}
                      className="flex flex-col text-left flex-1 min-w-0"
                    >
                      <span className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                        {ws.name}
                      </span>
                      {ws.description && (
                        <span className="text-xs text-text-secondary truncate mt-0.5 max-w-[200px]">
                          {ws.description}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-text-secondary font-mono mr-1">
                        {formatLastOpened(ws.lastOpenedAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteWorkspace(ws.id)}
                        className="h-7 w-7 p-0 text-text-secondary hover:text-rose-500 rounded opacity-0 group-hover:opacity-100"
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
        </CardContent>
      </Card>
    </div>
  );
};

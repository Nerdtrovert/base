import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';

export const ContinueWorking: React.FC = () => {
  const { setActiveWorkspaceId } = useBaseStore();
  const navigate = useNavigate();

  const workspaces = useLiveQuery(() => db.workspaces.toArray()) || [];
  const lastOpenedWorkspace = [...workspaces]
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0];

  const formatLastOpened = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  if (!lastOpenedWorkspace) return null;

  const handleResume = () => {
    setActiveWorkspaceId(lastOpenedWorkspace.id);
    navigate(`/workspace/${lastOpenedWorkspace.id}`);
  };

  return (
    <div 
      onClick={handleResume} 
      className="pb-6 border-b border-border-color flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:opacity-85 transition-opacity"
    >
      <div className="space-y-1">
        <span className="text-xs font-semibold text-accent uppercase tracking-wider block">
          Continue Working
        </span>
        <h3 className="text-xl font-semibold text-text-primary">
          {lastOpenedWorkspace.name}
        </h3>
        <p className="text-xs font-normal text-text-secondary">
          Last edited {formatLastOpened(lastOpenedWorkspace.lastOpenedAt)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleResume();
        }}
        className="self-start sm:self-center text-sm font-semibold text-accent hover:underline cursor-pointer bg-transparent border-none p-0"
      >
        Resume &rarr;
      </button>
    </div>
  );
};

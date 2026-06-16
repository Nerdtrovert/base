import React from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { Sparkles, X } from 'lucide-react';

export const CompanionBanner: React.FC = () => {
  const { companionMessage, clearCompanionMessage } = useBaseStore();

  if (!companionMessage) return null;

  const bgStyles = {
    info: 'bg-accent-light text-text-primary border border-border-color',
    success: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-6 text-sm transition-all duration-200 animate-fade-in ${bgStyles[companionMessage.type]}`}>
      <div className="flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 flex-shrink-0 opacity-80" />
        <span className="font-medium">{companionMessage.text}</span>
      </div>
      <button 
        onClick={clearCompanionMessage}
        className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors opacity-60 hover:opacity-100"
        aria-label="Dismiss banner"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

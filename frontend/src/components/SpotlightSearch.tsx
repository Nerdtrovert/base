import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { searchEverything, type SearchResult } from '../utils/search';
import { db } from '../services/db';
import { openAndIndexResource } from '../utils/smartCache';
import { Search, Folder, MessageSquare, CheckSquare, Link, CornerDownLeft, HardDrive, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SpotlightSearch: React.FC = () => {
  const { isSearchOpen, setSearchOpen, setActiveWorkspaceId, connectedDriveAccounts } = useBaseStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Focus input on open
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isSearchOpen]);

  // Execute search
  useEffect(() => {
    let active = true;
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      
      const activeDrives = connectedDriveAccounts
        ? connectedDriveAccounts.map(d => d.email)
        : [];
        
      const searchRes = await searchEverything(query, activeDrives);
      if (active) {
        setResults(searchRes.slice(0, 30)); // limit to top 30 to allow group division
        setSelectedIndex(0);
      }
    };

    const debounce = setTimeout(fetchResults, 150);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [query, connectedDriveAccounts]);

  // Group results dynamically
  const groupedResults = React.useMemo(() => {
    const groups: { [key in 'notes' | 'resources' | 'tasks' | 'ideas' | 'workspaces' | 'tags']: SearchResult[] } = {
      notes: [],
      resources: [],
      tasks: [],
      ideas: [],
      workspaces: [],
      tags: [],
    };

    results.forEach((item) => {
      if (item.type === 'note') groups.notes.push(item);
      else if (item.type === 'resource' || item.type === 'gdrive') groups.resources.push(item);
      else if (item.type === 'task') groups.tasks.push(item);
      else if (item.type === 'idea') groups.ideas.push(item);
      else if (item.type === 'workspace') groups.workspaces.push(item);
      else if (item.type === 'tag') groups.tags.push(item);
    });

    return groups;
  }, [results]);

  // Flattened for keyboard navigation
  const flatSelectableItems = React.useMemo(() => {
    return [
      ...groupedResults.notes,
      ...groupedResults.resources,
      ...groupedResults.tasks,
      ...groupedResults.ideas,
      ...groupedResults.workspaces,
      ...groupedResults.tags
    ];
  }, [groupedResults]);

  // Global toggle shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!isSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setSearchOpen]);

  // Keyboard navigation inside search dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatSelectableItems.length ? (prev + 1) % flatSelectableItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (flatSelectableItems.length ? (prev - 1 + flatSelectableItems.length) % flatSelectableItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatSelectableItems[selectedIndex]) {
        handleSelect(flatSelectableItems[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: SearchResult) => {
    setSearchOpen(false);
    if (item.type === 'workspace') {
      setActiveWorkspaceId(item.id);
      navigate(`/workspace/${item.id}`);
    } else if (item.type === 'gdrive') {
      const itemUrl = item.url;
      if (itemUrl) {
        window.open(itemUrl, '_blank');
        const itemTitle = item.title;
        const mimeType = (item as any).mimeType;
        (async () => {
          try {
            let existing = await db.resources.where('url').equals(itemUrl).first();
            if (!existing) {
              const activeWsId = useBaseStore.getState().activeWorkspaceId;
              const isPdf = itemTitle.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
              await useBaseStore.getState().createResource({
                title: itemTitle,
                url: itemUrl,
                type: isPdf ? 'pdf' : 'drive',
                workspaceId: activeWsId || null,
                mimeType: mimeType
              });
              existing = await db.resources.where('url').equals(itemUrl).first();
            }
            if (existing) {
              await openAndIndexResource(existing.id);
            }
          } catch (err) {
            console.error('[Drive Open] Failed to lazily save/index:', err);
          }
        })();
      }
    } else if (item.type === 'tag') {
      // Navigate to timeline with this tag pre-filled!
      navigate(`/timeline?search=${encodeURIComponent(item.title)}`);
    } else if (item.workspaceId) {
      setActiveWorkspaceId(item.workspaceId);
      navigate(`/workspace/${item.workspaceId}`);
    } else {
      setActiveWorkspaceId(null);
      navigate('/');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setSearchOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/40 dark:bg-black/60 backdrop-blur-[4px]"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div 
            ref={containerRef}
            className="w-full max-w-2xl bg-card-bg border border-border-color rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
            onKeyDown={handleKeyDown}
            initial={{ scale: 0.97, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
          >
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border-color">
              <Search className="w-5 h-5 text-text-secondary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Remember..."
                className="w-full bg-transparent border-none outline-none text-text-primary placeholder:text-text-secondary text-lg"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 px-1.5 py-0.5 border border-border-color rounded bg-bg-app text-[10px] font-mono text-text-secondary">
                ESC
              </div>
            </div>

            {/* Results list */}
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
              {query.trim() === '' ? (
                <div className="py-8 text-center text-text-secondary text-sm">
                  Type to start searching...
                </div>
              ) : flatSelectableItems.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="space-y-4">
                  {(Object.keys(groupedResults) as Array<keyof typeof groupedResults>).map((category) => {
                    const items = groupedResults[category];
                    if (items.length === 0) return null;

                    let headerIcon = '📝';
                    let headerLabel = 'Notes';
                    if (category === 'resources') { headerIcon = '📚'; headerLabel = 'Resources'; }
                    else if (category === 'tasks') { headerIcon = '✅'; headerLabel = 'Tasks'; }
                    else if (category === 'ideas') { headerIcon = '💡'; headerLabel = 'Ideas'; }
                    else if (category === 'workspaces') { headerIcon = '📁'; headerLabel = 'Projects'; }
                    else if (category === 'tags') { headerIcon = '🏷️'; headerLabel = 'Tags'; }

                    return (
                      <div key={category} className="space-y-1">
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] px-2 py-1 flex items-center gap-1.5 select-none border-b border-border-color/40 pb-1 mb-1.5">
                          <span className="text-xs">{headerIcon}</span>
                          <span>{headerLabel} ({items.length})</span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((item) => {
                            const globalIndex = flatSelectableItems.findIndex((x) => x.id === item.id);
                            const isSelected = globalIndex === selectedIndex;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl text-left transition-all duration-100 ${
                                  isSelected 
                                    ? 'bg-accent-light text-accent' 
                                    : 'text-text-primary hover:bg-accent-light/20'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                                    isSelected 
                                      ? 'bg-accent text-white' 
                                      : 'bg-bg-app text-text-secondary border border-border-color'
                                  }`}>
                                    {item.type === 'workspace' && <Folder className="w-3.5 h-3.5" />}
                                    {item.type === 'note' && <FileText className="w-3.5 h-3.5" />}
                                    {item.type === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                                    {item.type === 'resource' && <Link className="w-3.5 h-3.5" />}
                                    {item.type === 'gdrive' && <HardDrive className="w-3.5 h-3.5" />}
                                    {item.type === 'idea' && <MessageSquare className="w-3.5 h-3.5" />}
                                    {item.type === 'tag' && <span className="text-[10px] font-bold font-mono">#</span>}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate leading-snug">
                                      {item.title}
                                    </div>
                                    {item.type !== 'tag' && (
                                      <div className={`text-xs truncate font-medium ${isSelected ? 'text-accent/80' : 'text-text-secondary'}`}>
                                        {item.subtitle} {item.workspaceName ? `in ${item.workspaceName}` : ''}
                                      </div>
                                    )}
                                    {item.snippet && (
                                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1 border-l-2 border-emerald-500/50 pl-2 max-w-lg truncate">
                                        {item.snippet}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isSelected && (
                                  <div className="flex items-center gap-1 text-[10px] font-medium text-accent">
                                    <CornerDownLeft className="w-3 h-3" />
                                    <span>Go</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-app/50 border-t border-border-color text-[11px] text-text-secondary">
              <div className="flex items-center gap-3 font-medium">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
              </div>
              <span className="font-semibold text-[10px] uppercase tracking-wider text-accent">Remember</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

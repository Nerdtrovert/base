import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { searchEverything, type SearchResult } from '../utils/search';
import { Search, Folder, MessageSquare, CheckSquare, Link, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SpotlightSearch: React.FC = () => {
  const { isSearchOpen, setSearchOpen, setActiveWorkspaceId } = useBaseStore();
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
      const searchRes = await searchEverything(query);
      if (active) {
        setResults(searchRes.slice(0, 8)); // limit to top 8
        setSelectedIndex(0);
      }
    };

    const debounce = setTimeout(fetchResults, 150);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [query]);

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
      setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item: SearchResult) => {
    setSearchOpen(false);
    if (item.type === 'workspace') {
      setActiveWorkspaceId(item.id);
      navigate(`/workspace/${item.id}`);
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
            className="w-full max-w-2xl bg-card-bg border border-border-color rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onKeyDown={handleKeyDown}
            initial={{ scale: 0.97, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: -8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
          >
            {/* Search Input using shadcn/ui design */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border-color">
              <Search className="w-5 h-5 text-text-secondary flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search workspaces, notes, tasks, files..."
                className="w-full bg-transparent border-none outline-none text-text-primary placeholder-text-secondary text-lg"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 px-1.5 py-0.5 border border-border-color rounded bg-bg-app text-[10px] font-mono text-text-secondary">
                ESC
              </div>
            </div>

            {/* Results list */}
            <div className="max-h-[350px] overflow-y-auto p-2">
              {query.trim() === '' ? (
                <div className="py-8 text-center text-text-secondary text-sm">
                  Type to start searching...
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm">
                  No results found for "{query}"
                </div>
              ) : (
                <div className="space-y-0.5">
                  {results.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors ${
                          isSelected 
                            ? 'bg-accent-light text-accent' 
                            : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            isSelected 
                              ? 'bg-accent text-white' 
                              : 'bg-bg-app text-text-secondary border border-border-color'
                          }`}>
                            {item.type === 'workspace' && <Folder className="w-4 h-4" />}
                            {item.type === 'capture' && <MessageSquare className="w-4 h-4" />}
                            {item.type === 'task' && <CheckSquare className="w-4 h-4" />}
                            {item.type === 'resource' && <Link className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate text-sm">
                              {item.title}
                            </div>
                            <div className={`text-xs truncate ${isSelected ? 'text-accent/80' : 'text-text-secondary'}`}>
                              {item.subtitle} {item.workspaceName ? `in ${item.workspaceName}` : ''}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-accent">
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>Go</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-app/50 border-t border-border-color text-[11px] text-text-secondary">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
              </div>
              <span>Search Everything</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

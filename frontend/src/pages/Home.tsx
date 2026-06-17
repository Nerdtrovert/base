import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { QuickCapture } from '../components/QuickCapture';
import { ContinueWorking } from '../components/ContinueWorking';
import { CalendarWidget } from '../components/CalendarWidget';
import { TaskDashboard } from '../components/TaskDashboard';
import { RecentActivity } from '../components/RecentActivity';
import { PinnedResources } from '../components/PinnedResources';
import { WorkspaceList } from '../components/WorkspaceList';
import { Search, Sparkles, Folder, MessageSquare, CheckSquare, Link as LinkIcon, HardDrive, CornerDownLeft } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { Card, CardContent } from '../components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { searchEverything, type SearchResult } from '../utils/search';

export const Home: React.FC = () => {
  const { user, showCompanionMessage, setActiveWorkspaceId, connectedDriveAccounts } = useBaseStore();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('');
  
  // Spotlight Search States
  const [searchVal, setSearchVal] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Quiet Context Rotation States
  const quietMessages = [
    "Press ⌘K or Ctrl+K anywhere to search through your entire workspace context instantly.",
    "Base auto-saves everything in real-time. Feel free to capture ideas now and organize them later.",
    "Need a late session? Toggle Night Studio mode using the sun/moon button in the top navigation.",
    "Workspaces act as subject nodes. Pin resources, schedule tasks, and keep notes side-by-side.",
    "No messy folders. Use the persistent search bar to retrieve anything in just a few keystrokes.",
    "The Timeline tab logs all your activities chronologically to help you review daily learning progress.",
    "Base is local-first and works offline. Log in to sync your notebooks securely across devices."
  ];
  const [quietMsgIndex, setQuietMsgIndex] = useState(0);

  // Greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    const name = user ? user.name.split(' ')[0] : 'there';
    if (hour < 12) setGreeting(`Good morning, ${name}.`);
    else if (hour < 18) setGreeting(`Good afternoon, ${name}.`);
    else setGreeting(`Good evening, ${name}.`);
  }, [user]);

  // Rotate Quiet Context messages every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuietMsgIndex((prev) => (prev + 1) % quietMessages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Companion Banner random prompts
  useEffect(() => {
    const companionQuotes = [
      "Auto-saved. Future-you says thanks.",
      "Looks like a busy day. Let's finish one thing at a time.",
      "You've been here for a while. Stretch?",
      "Stretch? Your neck and shoulders will thank you.",
      "Everything stays exactly where you left it."
    ];
    
    const randomQuote = companionQuotes[Math.floor(Math.random() * companionQuotes.length)];
    
    const timer = setTimeout(() => {
      if (Math.random() < 0.35) {
        showCompanionMessage(randomQuote, 'info');
      }
    }, 12000);

    return () => clearTimeout(timer);
  }, [showCompanionMessage]);

  // Perform search debounced
  useEffect(() => {
    let active = true;
    const fetchResults = async () => {
      if (!searchVal.trim()) {
        setResults([]);
        return;
      }
      
      const activeDrives = connectedDriveAccounts
        ? connectedDriveAccounts.map(d => d.email)
        : [];
        
      const searchRes = await searchEverything(searchVal, activeDrives);
      if (active) {
        setResults(searchRes.slice(0, 8)); // Limit to top 8 items
        setSelectedIndex(0);
      }
    };

    const debounce = setTimeout(fetchResults, 150);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [searchVal, connectedDriveAccounts]);

  // Focus Search input on Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
    };
    window.addEventListener('keydown', handleGlobalK);
    return () => window.removeEventListener('keydown', handleGlobalK);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setSearchVal('');
      setIsSearchFocused(false);
      searchInputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectSearchResult(results[selectedIndex]);
      }
    }
  };

  const handleSelectSearchResult = (item: SearchResult) => {
    setSearchVal('');
    setIsSearchFocused(false);
    if (item.type === 'workspace') {
      setActiveWorkspaceId(item.id);
      navigate(`/workspace/${item.id}`);
    } else if (item.type === 'gdrive') {
      if (item.url) window.open(item.url, '_blank');
    } else if (item.workspaceId) {
      setActiveWorkspaceId(item.workspaceId);
      navigate(`/workspace/${item.workspaceId}`);
    } else {
      setActiveWorkspaceId(null);
      navigate('/');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in pb-24">
      
      {/* 1. Greeting Header */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="absolute inset-y-6 left-5 hidden md:block w-px bg-[linear-gradient(180deg,rgba(217,89,81,0),rgba(217,89,81,0.2),rgba(217,89,81,0))]" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3 md:pl-6">
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                <span className="hero-brand-glow">
                  <BrandMark className="h-9 w-9" />
                </span>
                <span>Quiet Workspace</span>
              </div>
              <div className="space-y-1">
                <h1 className="max-w-2xl text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary">
                  {greeting}
                </h1>
                <h2 className="max-w-2xl text-lg md:text-xl font-medium text-text-secondary leading-relaxed">
                  Everything you need is already here.
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
                  Your notes, tasks, files, and half-formed ideas stay quietly within reach.
                </p>
              </div>
            </div>
            
            {/* Dynamic Quiet Context Card */}
            <div className="rounded-[28px] border border-accent/15 bg-accent-light/50 px-5 py-4 w-full md:max-w-xs min-h-[110px] flex flex-col justify-center shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
                Quiet Context
              </p>
              <div className="relative mt-2 min-h-[50px] flex items-start">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={quietMsgIndex}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.3 }}
                    className="text-xs font-normal text-text-secondary leading-relaxed"
                  >
                    {quietMessages[quietMsgIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-text-secondary md:pl-6">
            <Sparkles className="w-3.5 h-3.5 text-accent/75 animate-pulse" />
            <span>This is your base{user ? `, ${user.name.split(' ')[0]}` : ''}. Quietly remembering everything for you.</span>
          </p>
        </CardContent>
      </Card>

      {/* 2. Spotlight Search (Permanently Visible) */}
      <div className="relative z-30">
        <div className="relative flex items-center bg-card-bg border border-border-color rounded-[28px] focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/15 transition-all shadow-md">
          <Search className="w-5 h-5 text-accent ml-5 flex-shrink-0" />
          <input
            ref={searchInputRef}
            id="home-search-input"
            type="text"
            placeholder="Search notes, tasks, ideas, and resources..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              // Delay slightly to allow click event on results to fire
              setTimeout(() => setIsSearchFocused(false), 200);
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-full bg-transparent border-none outline-none py-4 px-3 text-lg text-text-primary placeholder:text-text-secondary focus:ring-0"
          />
          <div className="hidden sm:flex items-center gap-1.5 mr-5 px-2.5 py-1.5 border border-border-color rounded-xl bg-bg-app/85 text-xs font-mono text-text-secondary">
            <span>{typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'}</span>
          </div>
        </div>
        
        {/* Spotlight Results Dropdown Overlay */}
        <AnimatePresence>
          {isSearchFocused && searchVal.trim() && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 4, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              className="absolute left-0 right-0 bg-card-bg border border-border-color rounded-[28px] shadow-2xl overflow-hidden mt-1 max-h-[350px] overflow-y-auto p-2 z-50"
            >
              {results.length === 0 ? (
                <div className="py-8 text-center text-text-secondary text-sm">
                  No results found for "{searchVal}"
                </div>
              ) : (
                <div className="space-y-0.5">
                  {results.map((item, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onMouseDown={() => handleSelectSearchResult(item)}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors ${
                          isSelected 
                            ? 'bg-accent-light text-accent font-medium' 
                            : 'text-text-primary hover:bg-accent-light/20'
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
                            {item.type === 'resource' && <LinkIcon className="w-4 h-4" />}
                            {item.type === 'gdrive' && <HardDrive className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate text-sm">
                              {item.title}
                            </div>
                            <div className={`text-xs truncate ${isSelected ? 'text-accent/80' : 'text-text-secondary'}`}>
                              {item.subtitle} {item.workspaceName ? `in ${item.workspaceName}` : ''}
                            </div>
                            {item.snippet && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1 border-l-2 border-emerald-500/50 pl-2 max-w-lg truncate">
                                {item.snippet}
                              </div>
                            )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (Primary Widgets) */}
        <div className="lg:col-span-2 space-y-6">
          {/* 3. New Idea (Quick Capture) */}
          <QuickCapture />

          {/* 4. Continue Working */}
          <ContinueWorking />

          {/* 6. Today's Tasks */}
          <TaskDashboard />

          {/* 8. Pinned Resources */}
          <PinnedResources />
        </div>

        {/* Right Column (Secondary / Sidebar Widgets) */}
        <div className="space-y-6">
          {/* 5. Coming Up (Calendar) */}
          <CalendarWidget />

          {/* 7. Recent Activity */}
          <RecentActivity />

          {/* 9. Workspaces */}
          <WorkspaceList />
        </div>

      </div>

    </div>
  );
};

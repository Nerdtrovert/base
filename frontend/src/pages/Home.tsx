import React, { useEffect, useState } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { QuickCapture } from '../components/QuickCapture';
import { WorkspaceList } from '../components/WorkspaceList';
import { CalendarWidget } from '../components/CalendarWidget';
import { TaskDashboard } from '../components/TaskDashboard';
import { RecentActivity } from '../components/RecentActivity';
import { PinnedResources } from '../components/PinnedResources';
import { Search, Sparkles } from 'lucide-react';
import { BrandMark } from '../components/BrandMark';

export const Home: React.FC = () => {
  const { user, setSearchOpen, showCompanionMessage } = useBaseStore();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    // Generate greeting based on time of day
    const hour = new Date().getHours();
    const name = user ? user.name.split(' ')[0] : 'there';
    if (hour < 12) setGreeting(`Good morning, ${name}.`);
    else if (hour < 18) setGreeting(`Good afternoon, ${name}.`);
    else setGreeting(`Good evening, ${name}.`);
  }, [user]);

  // Spawn an occasional companion check-in message
  useEffect(() => {
    const companionQuotes = [
      "Auto-saved. Future-you says thanks.",
      "Looks like a busy day. Let's focus on one thing at a time.",
      "You've been here for a while. Let's stretch? Your shoulders will thank you.",
      "Take a deep breath. You're doing great."
    ];
    
    // Choose a quote at random
    const randomQuote = companionQuotes[Math.floor(Math.random() * companionQuotes.length)];
    
    // Trigger after 10 seconds, but only with a 30% chance to keep it surprise-based
    const timer = setTimeout(() => {
      if (Math.random() < 0.3) {
        showCompanionMessage(randomQuote, 'info');
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [showCompanionMessage]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in">
      
      {/* Greeting Header */}
      <div className="surface-paper relative overflow-hidden rounded-[2rem] border border-border-color px-5 py-6 md:px-7 md:py-7">
        <div className="absolute inset-y-6 left-5 hidden md:block w-px bg-[linear-gradient(180deg,rgba(217,89,81,0),rgba(217,89,81,0.28),rgba(217,89,81,0))]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 md:pl-6">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
              <span className="hero-brand-glow">
                <BrandMark className="h-9 w-9" />
              </span>
              <span>Layered Memory</span>
            </div>
            <div className="space-y-1.5">
              <h1 className="max-w-2xl text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
                {greeting}
              </h1>
              <p className="max-w-2xl text-sm md:text-[15px] leading-7 text-text-secondary">
                Your notes, tasks, files, and half-formed ideas stay neatly within reach, so returning to work feels calm and immediate.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-accent/15 bg-accent-light/60 px-4 py-3 md:max-w-xs">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Quiet Context
            </p>
            <p className="mt-1.5 text-sm leading-6 text-text-secondary">
              Search first, capture quickly, and let the workspace keep everything organized without asking you to manage it.
            </p>
          </div>
        </div>
        <p className="mt-5 flex items-center gap-1.5 text-sm text-text-secondary md:pl-6">
          <Sparkles className="w-4 h-4 text-accent/75 animate-pulse" />
          <span>A workspace that remembers, so you can focus.</span>
        </p>
      </div>



      {/* Spotlight Search Trigger */}
      <div className="relative">
        <button
          onClick={() => setSearchOpen(true)}
          className="surface-paper w-full flex items-center justify-between gap-3 px-5 py-4 border border-border-color rounded-[1.65rem] hover:border-accent/40 text-left transition-all hover:scale-[0.995]"
        >
          <div className="flex items-center gap-3 text-text-secondary">
            <Search className="w-5 h-5 text-accent" />
            <span className="text-base">Search everything you were thinking about, saving, or planning...</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-border-color rounded-xl bg-bg-app/85 text-xs font-mono text-text-secondary">
            <span>{typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'}</span>
            <span>K</span>
          </div>
        </button>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Workspaces, Capture, Tasks) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Capture */}
          <QuickCapture />

          {/* Continue Working & Workspaces */}
          <WorkspaceList />

          {/* Today's Tasks */}
          <TaskDashboard />

          {/* Pinned Resources */}
          <PinnedResources />
        </div>

        {/* Right Column (Calendar, Timeline) */}
        <div className="space-y-6">
          {/* Calendar Widget */}
          <CalendarWidget />

          {/* Timeline Memory */}
          <RecentActivity />
        </div>

      </div>

    </div>
  );
};

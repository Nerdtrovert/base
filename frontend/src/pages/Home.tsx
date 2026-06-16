import React, { useEffect, useState } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { QuickCapture } from '../components/QuickCapture';
import { WorkspaceList } from '../components/WorkspaceList';
import { CalendarWidget } from '../components/CalendarWidget';
import { TaskDashboard } from '../components/TaskDashboard';
import { RecentActivity } from '../components/RecentActivity';
import { PinnedResources } from '../components/PinnedResources';
import { CompanionBanner } from '../components/CompanionBanner';
import { Search, Sparkles } from 'lucide-react';

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
      "Looks like a busy day. Let's finish one thing at a time.",
      "You've been here for a while. Stretch? Your shoulders will appreciate it.",
      "Take a deep breath. You're doing great."
    ];
    
    // Choose a quote at random
    const randomQuote = companionQuotes[Math.floor(Math.random() * companionQuotes.length)];
    
    const timer = setTimeout(() => {
      showCompanionMessage(randomQuote, 'info');
    }, 3000); // Trigger after 3 seconds of load

    return () => clearTimeout(timer);
  }, [showCompanionMessage]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in">
      
      {/* Greeting Header */}
      <div className="space-y-1.5">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
          {greeting}
        </h1>
        <p className="text-sm text-text-secondary flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-accent/75 animate-pulse" />
          <span>A workspace that remembers, so you can focus.</span>
        </p>
      </div>

      {/* Companion Banner Notification */}
      <CompanionBanner />

      {/* Spotlight Search Trigger */}
      <div className="relative">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 border border-border-color rounded-2xl bg-card-bg hover:border-accent/40 shadow-card-shadow text-left transition-all hover:scale-[0.99]"
        >
          <div className="flex items-center gap-3 text-text-secondary">
            <Search className="w-5 h-5 text-accent" />
            <span className="text-base">Search everything (workspaces, notes, tasks, files)...</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border-color rounded-lg bg-bg-app text-xs font-mono text-text-secondary">
            <span>Cmd</span>
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

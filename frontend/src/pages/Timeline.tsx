import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { 
  MessageSquare, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  CheckCircle, 
  FileText, 
  Trash2, 
  Search, 
  Folder, 
  X,
  ChevronLeft,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineItem {
  id: string;
  type: 'note' | 'link' | 'image' | 'idea' | 'task-completed' | 'resource-added';
  title: string;
  subtitle?: string;
  timestamp: number;
  url?: string;
  workspaceId: string | null;
  workspaceName?: string;
}

export const Timeline: React.FC = () => {
  const navigate = useNavigate();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const data = useLiveQuery(async () => {
    const workspaces = await db.workspaces.toArray();
    const captures = await db.captures.toArray();
    const resources = await db.resources.toArray();
    const tasks = await db.tasks.toArray();

    const workspaceMap = new Map<string, string>();
    workspaces.forEach(w => workspaceMap.set(w.id, w.name));

    const items: TimelineItem[] = [];

    captures.forEach(c => {
      items.push({
        id: c.id,
        type: c.type,
        title: c.content || (c.type === 'image' ? 'Captured Image' : 'Idea'),
        timestamp: c.createdAt,
        url: c.url,
        workspaceId: c.workspaceId,
        workspaceName: c.workspaceId ? workspaceMap.get(c.workspaceId) : undefined
      });
    });

    resources.forEach(r => {
      if (!captures.some(c => c.url === r.url && Math.abs(c.createdAt - r.createdAt) < 2000)) {
        items.push({
          id: r.id,
          type: 'resource-added',
          title: `Added Resource: ${r.title}`,
          subtitle: r.type.toUpperCase(),
          timestamp: r.createdAt,
          url: r.url,
          workspaceId: r.workspaceId,
          workspaceName: r.workspaceId ? workspaceMap.get(r.workspaceId) : undefined
        });
      }
    });

    tasks.forEach(t => {
      if (t.completed && t.completedAt) {
        items.push({
          id: t.id,
          type: 'task-completed',
          title: `Completed Task: ${t.title}`,
          timestamp: t.completedAt,
          workspaceId: t.workspaceId,
          workspaceName: t.workspaceId ? workspaceMap.get(t.workspaceId) : undefined
        });
      }
    });

    items.sort((a, b) => b.timestamp - a.timestamp);

    return {
      items,
      workspaces
    };
  }) || { items: [], workspaces: [] };

  const handleDeleteItem = async (item: TimelineItem) => {
    if (item.type === 'task-completed') {
      await db.tasks.delete(item.id);
    } else if (item.type === 'resource-added') {
      await db.resources.delete(item.id);
    } else {
      await db.captures.delete(item.id);
    }
  };

  const getIcon = (type: TimelineItem['type']) => {
    switch (type) {
      case 'note':
        return <FileText className="w-4 h-4 text-amber-500" />;
      case 'link':
      case 'resource-added':
        return <LinkIcon className="w-4 h-4 text-blue-500" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'task-completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-accent" />;
    }
  };

  // Filtering
  const filteredItems = data.items.filter(item => {
    if (selectedWorkspaceId !== 'all') {
      if (item.workspaceId !== selectedWorkspaceId) return false;
    }

    if (dateFilter !== 'all') {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      if (dateFilter === 'today') {
        const itemDate = new Date(item.timestamp).toDateString();
        const today = new Date().toDateString();
        if (itemDate !== today) return false;
      } else if (dateFilter === 'week') {
        if (now - item.timestamp > 7 * oneDay) return false;
      } else if (dateFilter === 'month') {
        if (now - item.timestamp > 30 * oneDay) return false;
      }
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const titleMatch = item.title.toLowerCase().includes(q);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(q) || false;
      const wsMatch = item.workspaceName?.toLowerCase().includes(q) || false;
      if (!titleMatch && !subtitleMatch && !wsMatch) return false;
    }

    return true;
  });

  // Group by Date Helper
  const groupTimelineByDate = (items: TimelineItem[]) => {
    const groups: { [key: string]: TimelineItem[] } = {};
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    items.forEach(item => {
      const itemDate = new Date(item.timestamp);
      const itemDateStr = itemDate.toDateString();

      let label = itemDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
      if (itemDateStr === todayStr) {
        label = 'Today';
      } else if (itemDateStr === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    });

    return groups;
  };

  const groupedTimeline = groupTimelineByDate(filteredItems);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in min-h-[calc(100vh-4rem)]">
      
      {/* Header with Back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 border border-border-color bg-card-bg/40 hover:bg-bg-app rounded-xl text-text-secondary hover:text-accent transition-all hover:scale-105 active:scale-95"
          title="Back Home"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-2">
            <Clock className="w-7 h-7 text-accent" />
            <span>Project Timeline</span>
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-0.5">
            Chronological registry of your thoughts, actions, and resources.
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border border-border-color bg-card-bg/50 backdrop-blur-sm shadow-card-shadow">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-text-secondary" />
              <Input
                placeholder="Search actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 p-0.5 text-text-secondary hover:bg-bg-app rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Workspace filter */}
            <div>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full text-xs h-9 bg-card-bg border border-border-color rounded-xl px-2.5 focus:border-accent outline-none"
              >
                <option value="all">All Workspaces</option>
                {data.workspaces.map(w => (
                  <option key={w.id} value={w.id}>
                    📁 {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date filter buttons */}
            <div className="flex bg-bg-app/50 border border-border-color p-0.5 rounded-xl h-9">
              {(['all', 'today', 'week', 'month'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`flex-1 text-[10px] md:text-xs font-semibold rounded-lg capitalize transition-colors ${
                    dateFilter === f
                      ? 'bg-card-bg text-accent shadow-sm border border-border-color/30'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f === 'all' ? 'All Time' : f}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Feed */}
      <div className="space-y-8 relative pl-4 md:pl-6 border-l-2 border-border-color/50 ml-2 md:ml-4">
        
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-secondary italic">
            No activities matched your search filter criteria.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {Object.entries(groupedTimeline).map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-4 relative">
                
                {/* Date Bullet Badge */}
                <div className="absolute -left-[30px] md:-left-[38px] top-1.5 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full border-2 border-accent bg-bg-app shadow shadow-accent/20" />
                </div>

                {/* Date Heading */}
                <h3 className="text-xs md:text-sm font-bold text-text-primary uppercase tracking-wider pl-1 select-none">
                  {dateLabel}
                </h3>

                {/* Date's events */}
                <div className="space-y-3">
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      className="group relative flex items-start justify-between gap-4 p-4 rounded-2xl border border-border-color/65 bg-card-bg/60 hover:bg-card-bg shadow-sm hover:shadow-card-shadow transition-all hover:scale-[1.002]"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Icon Container */}
                        <div className="p-2.5 rounded-xl bg-bg-app border border-border-color/60 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                          {getIcon(item.type)}
                        </div>

                        <div className="min-w-0 space-y-1">
                          {/* Workspace badge */}
                          {item.workspaceName && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-accent uppercase tracking-widest bg-accent-light/50 border border-accent/10 px-2 py-0.5 rounded-full">
                              <Folder className="w-2.5 h-2.5" />
                              {item.workspaceName}
                            </span>
                          )}

                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm font-semibold text-text-primary hover:text-accent break-all leading-snug"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <p className="text-sm font-semibold text-text-primary break-words leading-snug">
                              {item.title}
                            </p>
                          )}

                          {item.subtitle && (
                            <span className="text-[10px] text-text-secondary block font-mono">
                              {item.subtitle}
                            </span>
                          )}

                          <span className="text-[10px] text-text-secondary block font-sans">
                            {new Date(item.timestamp).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Delete timeline record */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item)}
                        className="h-8 w-8 text-text-secondary hover:text-rose-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

    </div>
  );
};

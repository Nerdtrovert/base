import React, { useState, useEffect } from 'react';
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
  X,
  ChevronLeft,
  Clock
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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

interface LearningSession {
  id: string;
  timestamp: number;
  name: string;
  items: TimelineItem[];
}

export const Timeline: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Parse search parameter from tag navigation
  useEffect(() => {
    const params = new URLSearchParams(search);
    const q = params.get('search');
    if (q) {
      setSearchTerm(q);
    }
  }, [search]);

  const data = useLiveQuery(async () => {
    const workspaces = await db.workspaces.toArray();
    const captures = await db.captures.toArray();
    const resources = await db.resources.toArray();
    const tasks = await db.tasks.toArray();

    const workspaceMap = new Map<string, string>();
    workspaces.forEach(w => workspaceMap.set(w.id, w.name));

    const items: TimelineItem[] = [];

    captures.forEach(c => {
      let type: TimelineItem['type'] = 'idea';
      if (c.type === 'note') type = 'note';
      else if (c.type === 'image') type = 'image';
      else if (c.type === 'link') type = 'link';

      items.push({
        id: c.id,
        type,
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
          title: r.title,
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
          title: t.title,
          timestamp: t.completedAt,
          workspaceId: t.workspaceId,
          workspaceName: t.workspaceId ? workspaceMap.get(t.workspaceId) : undefined
        });
      }
    });

    // Sort descending globally
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
        return <FileText className="w-3.5 h-3.5 text-amber-500" />;
      case 'link':
      case 'resource-added':
        return <LinkIcon className="w-3.5 h-3.5 text-blue-500" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-500" />;
      case 'task-completed':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5 text-accent" />;
    }
  };

  const getSessionName = (sessionItems: TimelineItem[]) => {
    const counts: { [key: string]: number } = {};
    let maxCount = 0;
    let mostCommonWorkspaceName = '';
    
    sessionItems.forEach(item => {
      if (item.workspaceName) {
        counts[item.workspaceName] = (counts[item.workspaceName] || 0) + 1;
        if (counts[item.workspaceName] > maxCount) {
          maxCount = counts[item.workspaceName];
          mostCommonWorkspaceName = item.workspaceName;
        }
      }
    });

    if (mostCommonWorkspaceName) {
      const nameLower = mostCommonWorkspaceName.toLowerCase();
      if (nameLower.includes('integration') || nameLower.includes('project') || nameLower.includes('class') || nameLower.includes('study')) {
        return `Working on ${mostCommonWorkspaceName}`;
      }
      return `Working on ${mostCommonWorkspaceName} Integration`;
    }
    return 'General Working Session';
  };

  const getActionLabel = (item: TimelineItem) => {
    const title = item.title;
    const url = item.url || '';
    
    if (item.type === 'task-completed') {
      return `Completed Task: "${title}"`;
    }
    
    if (item.type === 'idea') {
      return `Captured Idea: "${title}"`;
    }
    
    if (item.type === 'note') {
      return `Added Note: "${title.split('\n')[0].substring(0, 60)}"`;
    }
    
    const isPdf = url.toLowerCase().includes('.pdf') || 
                  title.toLowerCase().includes('.pdf') || 
                  item.subtitle?.toLowerCase() === 'pdf';
    
    const isGithub = url.toLowerCase().includes('github.com');
    const isImage = item.type === 'image' || item.subtitle?.toLowerCase() === 'image';
    
    if (isPdf) {
      const cleanTitle = title.replace(/\.pdf$/i, '');
      return `Opened ${cleanTitle} PDF`;
    }
    
    if (isImage) {
      return `Copied Image`;
    }
    
    if (isGithub) {
      return `Visited GitHub Repo: "${title}"`;
    }
    
    if (item.type === 'link' || item.type === 'resource-added') {
      return `Visited Link: "${title}"`;
    }
    
    return `Captured Idea: "${title}"`;
  };

  // 1. Filter raw items
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
      return titleMatch || subtitleMatch || wsMatch;
    }

    return true;
  });

  // 2. Group into sessions
  const groupTimelineBySession = (items: TimelineItem[]): LearningSession[] => {
    const sessions: LearningSession[] = [];

    const sorted = [...items].sort((a, b) => b.timestamp - a.timestamp);
    const gapLimit = 2 * 60 * 60 * 1000; // 2 hours
    let currentSession: LearningSession | null = null;

    for (const item of sorted) {
      if (!currentSession) {
        currentSession = {
          id: `session-${item.id}`,
          timestamp: item.timestamp,
          name: '',
          items: [item]
        };
      } else {
        const lastItemInSession = currentSession.items[currentSession.items.length - 1];
        if (Math.abs(lastItemInSession.timestamp - item.timestamp) <= gapLimit) {
          currentSession.items.push(item);
        } else {
          currentSession.name = getSessionName(currentSession.items);
          sessions.push(currentSession);
          currentSession = {
            id: `session-${item.id}`,
            timestamp: item.timestamp,
            name: '',
            items: [item]
          };
        }
      }
    }

    if (currentSession) {
      currentSession.name = getSessionName(currentSession.items);
      sessions.push(currentSession);
    }

    return sessions;
  };

  const sessions = groupTimelineBySession(filteredItems);

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
            <span>Memory Replay</span>
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-0.5">
            Recreate active learning sessions and answer: What else was I doing when I learned this?
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
                placeholder="Search topic / tag to replay..."
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

            {/* Focus Mode filter */}
            <div>
              <select
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="w-full text-xs h-9 bg-card-bg border border-border-color rounded-xl px-2.5 focus:border-accent outline-none"
              >
                <option value="all">All Focus Modes</option>
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

      {/* Main timeline content */}
      <div className="space-y-6">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-[0.18em]">
          Sessions ({sessions.length})
        </div>
        
        {sessions.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-secondary italic bg-card-bg/10 border border-border-color/40 rounded-2xl">
            No active learning sessions found.
          </div>
        ) : (
          <div className="space-y-8">
            {sessions.map((session) => {
              // Sort items chronologically (earliest to latest) inside the session
              const chronoItems = [...session.items].sort((a, b) => a.timestamp - b.timestamp);
              const sessionStart = chronoItems[0].timestamp;
              const dateLabel = new Date(sessionStart).toLocaleDateString(undefined, { 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              });
              const timeLabel = new Date(sessionStart).toLocaleTimeString(undefined, { 
                hour: '2-digit', 
                minute: '2-digit' 
              });

              return (
                <Card 
                  key={session.id} 
                  className="border border-border-color/85 bg-card-bg/40 dark:bg-card-bg/10 shadow-sm rounded-3xl overflow-hidden hover:shadow-md transition-all duration-300"
                >
                  <CardContent className="p-6 space-y-6">
                    {/* Session Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color/60 pb-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-accent bg-accent-light px-2.5 py-1 rounded-full mb-1 inline-block">
                          Session
                        </span>
                        <h3 className="text-base font-bold text-text-primary tracking-tight mt-1">
                          "{session.name}"
                        </h3>
                      </div>
                      <div className="text-left sm:text-right flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0.5">
                        <span className="text-xs font-semibold text-text-primary font-mono">{chronoItems.length} items</span>
                        <span className="text-[11px] text-text-secondary font-sans">{dateLabel} • {timeLabel}</span>
                      </div>
                    </div>

                    {/* Session Timeline Chain */}
                    <div className="relative pl-8 md:pl-10 py-2">
                      <div className="space-y-8">
                        {chronoItems.map((item, idx) => {
                          const actionLabel = getActionLabel(item);
                          const itemTime = new Date(item.timestamp).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          return (
                            <div key={item.id} className="relative group/item">
                              {/* Dotted connector line segment */}
                              {idx < chronoItems.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-[-32px] border-l border-dashed border-border-color/90 pointer-events-none z-0" />
                              )}
                              
                              {/* Arrow connector overlay centered on the line */}
                              {idx < chronoItems.length - 1 && (
                                <div className="absolute left-0 top-[26px] w-6 flex justify-center pointer-events-none select-none z-10">
                                  <span className="text-accent text-[11px] font-bold">↓</span>
                                </div>
                              )}

                              {/* Action Node Bullet icon */}
                              <div className="absolute left-0 top-0.5 w-6 h-6 rounded-full border border-border-color/85 bg-card-bg flex items-center justify-center shadow-xs group-hover/item:border-accent transition-colors z-10">
                                {getIcon(item.type)}
                              </div>

                              <div className="min-w-0 pl-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {item.url ? (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-semibold text-text-primary hover:text-accent hover:underline break-words"
                                    >
                                      {actionLabel}
                                    </a>
                                  ) : (
                                    <p className="text-sm font-semibold text-text-primary break-words">
                                      {actionLabel}
                                    </p>
                                  )}
                                  {item.workspaceName && (
                                    <span className="inline-block text-[9px] font-bold text-accent uppercase tracking-widest bg-accent-light px-1.5 py-0.5 rounded-full mt-1.5 font-sans border border-accent/10">
                                      {item.workspaceName}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-text-secondary font-mono flex-shrink-0 self-start sm:self-center">
                                  {itemTime}
                                </span>
                              </div>

                              {/* Trash button */}
                              <div className="absolute right-0 top-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteItem(item)}
                                  className="h-7 w-7 text-text-secondary hover:text-rose-500 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity cursor-pointer flex-shrink-0"
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

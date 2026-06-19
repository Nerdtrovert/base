import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { MessageSquare, Link, Image, CheckCircle, FileText, Trash2, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface TimelineItem {
  id: string;
  type: 'note' | 'link' | 'image' | 'idea' | 'task-completed' | 'resource-added';
  title: string;
  subtitle?: string;
  timestamp: number;
  url?: string;
}

export const RecentActivity: React.FC = () => {
  const { activeWorkspaceId } = useBaseStore();
  const activityItems = useLiveQuery(async () => {
    let captures = await db.captures.toArray();
    let resources = await db.resources.toArray();
    let tasks = await db.tasks.toArray();

    if (activeWorkspaceId) {
      captures = captures.filter(c => c.workspaceId === activeWorkspaceId);
      resources = resources.filter(r => r.workspaceId === activeWorkspaceId);
      tasks = tasks.filter(t => t.workspaceId === activeWorkspaceId);
    }

    const items: TimelineItem[] = [];

    captures.forEach(c => {
      items.push({
        id: c.id,
        type: c.type,
        title: c.content || (c.type === 'image' ? 'Captured Image' : 'Idea'),
        timestamp: c.createdAt,
        url: c.url
      });
    });

    resources.forEach(r => {
      if (!captures.some(c => c.url === r.url && c.createdAt - r.createdAt < 2000)) {
        items.push({
          id: r.id,
          type: 'resource-added',
          title: `Added Resource: ${r.title}`,
          subtitle: r.type.toUpperCase(),
          timestamp: r.createdAt,
          url: r.url
        });
      }
    });

    tasks.forEach(t => {
      if (t.completed && t.completedAt) {
        items.push({
          id: t.id,
          type: 'task-completed',
          title: `Completed Task: ${t.title}`,
          timestamp: t.completedAt
        });
      }
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }) || [];

  const groupTimeline = (items: TimelineItem[]) => {
    const groups: { [key: string]: TimelineItem[] } = {};

    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    items.forEach(item => {
      const itemDate = new Date(item.timestamp);
      const itemDateStr = itemDate.toDateString();

      let label = itemDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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

  const groupedActivity = groupTimeline(activityItems.slice(0, 15));

  const handleDeleteItem = async (item: TimelineItem) => {
    const confirmed = window.confirm(
      `Remove this activity item?\n\nIf it was synced earlier, the recent version is still recoverable for 30 days.`
    );

    if (!confirmed) return;

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
        return <FileText className="w-3.5 h-3.5" />;
      case 'link':
      case 'resource-added':
        return <Link className="w-3.5 h-3.5" />;
      case 'image':
        return <Image className="w-3.5 h-3.5" />;
      case 'task-completed':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <MessageSquare className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="pb-6 border-b border-border-color">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
          <Clock className="w-4 h-4 text-accent" />
          <span>Recent Activity</span>
        </div>
      </div>

      {activityItems.length === 0 ? (
        <div className="py-8 text-center text-xs text-text-secondary italic">
          No memory records yet. Speak your mind or add a task to begin.
        </div>
      ) : (
        <motion.div className="space-y-6" layout>
          <AnimatePresence initial={false}>
            {Object.entries(groupedActivity).map(([dateLabel, items]) => (
              <motion.div 
                key={dateLabel} 
                className="space-y-3"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Date Header */}
                <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider pl-1.5 border-l-2 border-accent/40">
                  {dateLabel}
                </h4>

                <div className="space-y-3 relative border-l border-border-color/70 pl-3.5 ml-1.5 pt-1">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="relative flex items-start justify-between gap-3 group rounded-xl px-1.5 py-1 hover:bg-accent-light/20 transition-colors"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[20px] top-2 w-2 h-2 rounded-full border border-border-color bg-bg-app group-hover:border-accent transition-colors" />

                      <div className="flex items-start gap-2.5 min-w-0 flex-grow">
                        <div className="mt-0.5 text-text-secondary p-1 rounded-md bg-bg-app border border-border-color/50">
                          {getIcon(item.type)}
                        </div>

                        <div className="min-w-0 flex-grow">
                          {item.type === 'resource-added' ? (
                            <a
                              href={item.url ? (item.url.startsWith('http') ? item.url : `https://${item.url}`) : '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-text-primary hover:text-accent font-normal break-all flex items-center gap-1 inline-flex hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <p className="text-sm text-text-primary font-normal break-words leading-relaxed">
                              {item.title}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                            <span className="font-mono">
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {item.subtitle && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[150px]">
                                  {item.subtitle}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteItem(item)}
                        className="h-7 w-7 text-text-secondary hover:text-rose-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

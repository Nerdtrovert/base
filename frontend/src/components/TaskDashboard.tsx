import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Task } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { CheckSquare, Square, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export const TaskDashboard: React.FC = () => {
  const { activeWorkspaceId, createTask, toggleTask, deleteTask } = useBaseStore();
  const [newTitle, setNewTitle] = useState('');
  const [targetDay, setTargetDay] = useState<'today' | 'tomorrow' | 'week'>('today');

  // Reactively fetch tasks
  const allTasks = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    if (activeWorkspaceId) {
      return tasks.filter(t => t.workspaceId === activeWorkspaceId);
    }
    return tasks;
  }, [activeWorkspaceId]) || [];

  // Helper date strings
  const getOffsetDateString = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const todayStr = getOffsetDateString(0);
  const tomorrowStr = getOffsetDateString(1);
  const sevenDaysLimitStr = getOffsetDateString(8);

  // Group tasks
  const todayTasks = allTasks.filter(t => !t.completed && t.dueDate === todayStr);
  const tomorrowTasks = allTasks.filter(t => !t.completed && t.dueDate === tomorrowStr);
  const next7DaysTasks = allTasks.filter(t => {
    return !t.completed && t.dueDate > tomorrowStr && t.dueDate <= sevenDaysLimitStr;
  });
  const completedTasks = allTasks
    .filter(t => t.completed)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 5); // top 5 recently completed

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let dueDate = todayStr;
    if (targetDay === 'tomorrow') dueDate = tomorrowStr;
    else if (targetDay === 'week') dueDate = getOffsetDateString(3); // set to 3 days out as placeholder

    await createTask(newTitle.trim(), activeWorkspaceId, dueDate);
    setNewTitle('');
  };

  const handleDeleteTask = async (id: string, title: string) => {
    const confirmed = window.confirm(
      `Delete task "${title}"?\n\nThis only removes it from your dashboard. Your recent synced state is still recoverable for 30 days.`
    );

    if (!confirmed) return;
    await deleteTask(id);
  };

  const renderTaskList = (tasks: Task[], emptyMessage: string) => {
    if (tasks.length === 0) {
      return <div className="text-xs text-text-secondary italic py-1 px-2">{emptyMessage}</div>;
    }

    return (
      <motion.div className="space-y-1" layout>
        <AnimatePresence initial={false}>
          {tasks.map(task => (
            <motion.div 
              key={task.id} 
              className="flex items-center justify-between group p-1.5 rounded-lg hover:bg-accent-light/25 transition-colors"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -15, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={{ duration: 0.15 }}
              layout
            >
              <button
                onClick={() => toggleTask(task.id)}
                className="flex items-center gap-2.5 text-left text-sm font-sans flex-1 min-w-0"
              >
                {task.completed ? (
                  <CheckSquare className="w-4.5 h-4.5 text-accent flex-shrink-0" />
                ) : (
                  <Square className="w-4.5 h-4.5 text-text-secondary flex-shrink-0 hover:text-accent transition-colors" />
                )}
                <span className={`truncate ${task.completed ? 'line-through text-text-secondary opacity-60' : 'text-text-primary'}`}>
                  {task.title}
                </span>
              </button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteTask(task.id, task.title)}
                className="h-7 w-7 text-text-secondary hover:text-rose-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Delete task"
                title="Delete task. Your recent synced state remains recoverable for 30 days."
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="pb-6 border-b border-border-color space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
          <CheckSquare className="w-4 h-4 text-accent" />
          <span>Today's Tasks</span>
        </div>
      </div>

      {/* Task Quick Add Form */}
      <form onSubmit={handleAddTaskSubmit} className="flex flex-col gap-2 p-2.5 bg-bg-app/50 border border-border-color rounded-[28px]">
        <Input
          placeholder="Add a task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full bg-transparent border-none shadow-none p-1 focus-visible:ring-0 focus-visible:border-none"
        />
        <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-border-color/60">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant={targetDay === 'today' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTargetDay('today')}
              className="h-6 px-2.5 text-[10px]"
            >
              Today
            </Button>
            <Button
              type="button"
              variant={targetDay === 'tomorrow' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTargetDay('tomorrow')}
              className="h-6 px-2.5 text-[10px]"
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              variant={targetDay === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setTargetDay('week')}
              className="h-6 px-2.5 text-[10px]"
            >
              Next 7d
            </Button>
          </div>

          <Button
            type="submit"
            disabled={!newTitle.trim()}
            size="icon"
            className="h-7 w-7 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>

      {/* Sections */}
      <div className="space-y-4">
        {/* Today */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Today
          </h4>
          {renderTaskList(todayTasks, 'Nothing on the slate for today.')}
        </div>

        {/* Tomorrow */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
            Tomorrow
          </h4>
          {renderTaskList(tomorrowTasks, 'Clear for tomorrow.')}
        </div>

        {/* Next 7 Days */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-border-color" />
            Next 7 Days
          </h4>
          {renderTaskList(next7DaysTasks, 'No tasks scheduled in the next week.')}
        </div>

        {/* Recently Completed */}
        {completedTasks.length > 0 && (
          <div className="space-y-1 border-t border-dashed border-border-color/80 pt-3">
            <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 px-1">
              Recently Completed
            </h4>
            {renderTaskList(completedTasks, '')}
          </div>
        )}
      </div>
    </div>
  );
};

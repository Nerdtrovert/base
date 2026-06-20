import React from 'react';
import { Calendar } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';

export const CalendarWidget: React.FC = () => {
  const upcomingTasks = useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    const activeTasks = tasks.filter(t => !t.completed);
    
    // Sort tasks by due date ascending
    return activeTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }) || [];

  const displayTasks = upcomingTasks.slice(0, 3);

  // Get relative label for a due date
  const getDayLabel = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dueDateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    
    // Otherwise show day of the week or date
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (diffDays > 1 && diffDays < 7) {
      return daysOfWeek[targetDate.getDay()];
    }
    return targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
        <Calendar className="w-4 h-4 text-accent" />
        <span>Coming Up</span>
      </div>

      <div className="border-t border-border-color my-4" />

      <div className="space-y-4">
        {displayTasks.map((task, idx) => (
          <React.Fragment key={task.id}>
            <div className="flex flex-col text-sm py-1 animate-fade-in space-y-1 text-left">
              <span className="font-semibold text-text-primary">
                {getDayLabel(task.dueDate)}
              </span>
              <span className="font-normal text-text-secondary">
                {task.title}
              </span>
            </div>
            {idx < displayTasks.length - 1 && (
              <div className="border-t border-border-color my-4" />
            )}
          </React.Fragment>
        ))}

        {displayTasks.length === 0 && (
          <p className="text-xs text-text-muted italic py-2 text-left">All caught up! No upcoming tasks or deadlines.</p>
        )}
      </div>
    </div>
  );
};

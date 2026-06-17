import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface Event {
  dayLabel: string;
  title: string;
  time?: string;
  type: 'assignment' | 'review' | 'exam';
}

export const CalendarWidget: React.FC = () => {
  const events: Event[] = [];

  const badges = {
    assignment: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/15',
    review: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/15',
    exam: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15'
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4 text-xs font-semibold tracking-wider text-text-secondary">
          <Calendar className="w-4 h-4 text-accent" />
          <span>GOOGLE CALENDAR</span>
        </div>

        <div className="rounded-2xl border border-dashed border-border-color bg-bg-app/50 px-4 py-5">
          <p className="text-sm font-medium text-text-primary">
            Connect Google Calendar to show real events here.
          </p>
          <p className="mt-1.5 text-xs leading-6 text-text-secondary">
            The old sample items were placeholders. Once calendar linking is wired in, this panel should read from your synced events instead.
          </p>
          {events.length > 0 && (
            <div className="mt-4 space-y-4">
              {events.map((event, idx) => (
                <div 
                  key={idx}
                  className="flex items-start justify-between gap-3 group animate-fade-in"
                >
                  <div className="flex gap-3 min-w-0">
                    <div className="flex flex-col items-center flex-shrink-0 w-16 pt-0.5">
                      <span className="text-xs font-semibold text-text-primary uppercase tracking-tight">
                        {event.dayLabel}
                      </span>
                      <span className="text-[10px] text-text-secondary flex items-center gap-0.5 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {event.time}
                      </span>
                    </div>
                    <div className="w-0.5 h-10 bg-rose-500/15 self-stretch flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-text-primary truncate">
                        {event.title}
                      </h4>
                      <div className="flex gap-1.5 mt-1">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${badges[event.type]}`}>
                          {event.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

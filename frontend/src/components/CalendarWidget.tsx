import React from 'react';
import { Calendar } from 'lucide-react';

interface Event {
  dayLabel: string;
  title: string;
  time?: string;
  type: 'assignment' | 'review' | 'exam';
}

export const CalendarWidget: React.FC = () => {
  const events: Event[] = [
    { dayLabel: 'Today', title: 'OS Assignment', type: 'assignment', time: '2:00 PM' },
    { dayLabel: 'Tomorrow', title: 'Studio Review', type: 'review', time: '10:00 AM' },
    { dayLabel: 'Friday', title: 'Internal Exam', type: 'exam', time: '9:00 AM' }
  ];

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
        <Calendar className="w-4 h-4 text-accent" />
        <span>Coming Up</span>
      </div>

      <div className="border-t border-border-color my-4" />

      <div className="space-y-4">
        {events.map((event, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col text-sm py-1 animate-fade-in space-y-1">
              <span className="font-semibold text-text-primary">
                {event.dayLabel}
              </span>
              {event.time && (
                <span className="text-xs font-normal text-text-muted">
                  {event.time}
                </span>
              )}
              <span className="font-normal text-text-secondary">
                {event.title}
              </span>
            </div>
            {idx < events.length - 1 && (
              <div className="border-t border-border-color my-4" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

import { query } from '../database/postgres';
import { sendPushNotification } from './notification.service';

const MOTIVATIONS = [
  'A quiet context leads to clear focus. Take a deep breath.',
  'Your notes and tasks are safe. Take it one step at a time.',
  'Auto-saved. Future-you says thanks for registering notes today.',
  'One task at a time. The workspace remembers, so you do not have to.',
  'Start where you are. Use what you have. Do what you can.',
  'Focus on progress, not perfection.',
  'Small steps every day add up to big results.',
  'Quiet check-in: Clear your workspace, clear your mind.'
];

/**
 * Checks database for upcoming tasks and pushes reminders 4-5 hours before,
 * and schedules a daily quiet morning motivation prompt.
 */
export const runNotificationChecks = async () => {
  console.log('[Notification Scheduler] Running checks...');
  try {
    // 1. Get all users with active subscriptions
    const subUsersResult = await query(
      `SELECT DISTINCT user_id FROM push_subscriptions`
    );
    const userIds = subUsersResult.rows.map((row: any) => row.user_id);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    for (const userId of userIds) {
      // 2. Fetch the latest backup payload for this user to extract tasks
      const backupResult = await query(
        `SELECT payload FROM backups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (backupResult.rows.length === 0) {
        continue;
      }

      const payload = backupResult.rows[0].payload;
      const tasks = payload.tasks || [];

      // A. Upcoming Event / Task Reminders (4-5 hours before)
      for (const task of tasks) {
        // Skip completed tasks
        if (task.completed) continue;

        // Check if task has a due date matching today
        if (task.dueDate === todayStr) {
          // Parse time if specified in title, e.g. "ML Exam at 14:00" or "Project presentation by 16:30"
          let dueHour = 14; // Default to 2:00 PM if no time in title
          let dueMinute = 0;
          
          const taskTitle = task.title || '';
          const timeMatch = taskTitle.match(/(?:at|by|starts? at|due at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1], 10);
            const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3];

            if (ampm) {
              if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
              if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
            }
            dueHour = hour;
            dueMinute = minute;
          }

          // Construct due date/time object
          const dueTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dueHour, dueMinute, 0);
          const timeDifferenceMs = dueTime.getTime() - now.getTime();
          const hoursRemaining = timeDifferenceMs / (1000 * 60 * 60);

          // If task starts in 4 to 5 hours
          if (hoursRemaining >= 3.9 && hoursRemaining <= 5.1) {
            const contentIdentifier = `task-${task.id}-reminder`;

            // Check if reminder was already sent
            const sentCheck = await query(
              `SELECT 1 FROM sent_notifications WHERE user_id = $1 AND content_identifier = $2`,
              [userId, contentIdentifier]
            );

            if (sentCheck.rows.length === 0) {
              console.log(`[Notification Scheduler] Sending reminder for task: "${task.title}"`);
              await sendPushNotification(userId, {
                title: 'Upcoming Task Reminder',
                body: `Calendar Check-in: "${task.title}" is in 4 hours (${dueHour.toString().padStart(2, '0')}:${dueMinute.toString().padStart(2, '0')}).`,
                url: '/'
              });

              // Log sent notification to prevent overloading
              await query(
                `INSERT INTO sent_notifications (user_id, notification_type, content_identifier) VALUES ($1, $2, $3)`,
                [userId, 'reminder', contentIdentifier]
              );
            }
          }
        }
      }

      // B. Morning Motivation (Send once per day between 7 AM and 10 AM local/server time)
      const currentHour = now.getHours();
      if (currentHour >= 7 && currentHour <= 10) {
        const contentIdentifier = `motivation-${todayStr}`;

        // Check if motivation for today was already sent
        const sentCheck = await query(
          `SELECT 1 FROM sent_notifications WHERE user_id = $1 AND content_identifier = $2`,
          [userId, contentIdentifier]
        );

        if (sentCheck.rows.length === 0) {
          const randomQuote = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
          console.log(`[Notification Scheduler] Sending morning motivation to user ${userId}`);
          
          await sendPushNotification(userId, {
            title: 'Quiet Morning Motivation',
            body: randomQuote,
            url: '/'
          });

          // Log sent notification
          await query(
            `INSERT INTO sent_notifications (user_id, notification_type, content_identifier) VALUES ($1, $2, $3)`,
            [userId, 'motivation', contentIdentifier]
          );
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.warn('[Notification Scheduler] Database unreachable. Skipping notification checks.');
    } else {
      console.error('[Notification Scheduler] Error running notification checks:', error);
    }
  }
};

let schedulerInterval: NodeJS.Timeout | null = null;

export const startNotificationScheduler = (intervalMs = 60000) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }
  
  console.log(`[Notification Scheduler] Starting background checks every ${intervalMs / 1000}s`);
  // Run checks immediately on startup
  runNotificationChecks();
  
  schedulerInterval = setInterval(runNotificationChecks, intervalMs);
};

export const stopNotificationScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Notification Scheduler] Stopped background checks');
  }
};

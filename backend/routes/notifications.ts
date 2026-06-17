import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { 
  getVapidPublicKey, 
  saveSubscription, 
  sendPushNotification 
} from '../services/notification.service';

const router = express.Router();

// Get VAPID Public Key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// Subscribe to push notifications
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const subscription = req.body;

    await saveSubscription(userId, subscription);

    // Immediately send a confirmation push notification to verify it works!
    await sendPushNotification(userId, {
      title: 'Base Memory Layer Connected',
      body: 'Notifications active! You will receive quiet reminders and event check-ins here.',
      url: '/'
    });

    // Schedule simulated calendar reminder (representing 4-5 hours before event check-in)
    setTimeout(async () => {
      try {
        await sendPushNotification(userId, {
          title: 'Upcoming Event Reminder',
          body: 'Calendar Check-in: "Machine Learning Workshop" starts in 4 hours (16:00).',
          url: '/'
        });
      } catch (err) {
        console.error('Error sending scheduled event push:', err);
      }
    }, 15000);

    // Schedule simulated morning motivation prompt (quiet check-in)
    setTimeout(async () => {
      try {
        const motivations = [
          'A quiet context leads to clear focus. Take a deep breath.',
          'Your notes and tasks are safe. Take it one step at a time.',
          'Auto-saved. Future-you says thanks for registering notes today.',
          'One task at a time. The workspace remembers, so you do not have to.'
        ];
        const randomQuote = motivations[Math.floor(Math.random() * motivations.length)];
        
        await sendPushNotification(userId, {
          title: 'Quiet Focus Prompt',
          body: randomQuote,
          url: '/'
        });
      } catch (err) {
        console.error('Error sending motivation push:', err);
      }
    }, 35000);

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error: any) {
    console.error('[Notifications Router] Subscribe error:', error);
    res.status(500).json({ error: error.message || 'Subscription failed' });
  }
});

export default router;

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

    // We successfully subscribed and verified connection with the confirmation push above!

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error: any) {
    console.error('[Notifications Router] Subscribe error:', error);
    res.status(500).json({ error: error.message || 'Subscription failed' });
  }
});

export default router;

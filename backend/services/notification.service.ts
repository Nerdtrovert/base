import webpush from 'web-push';
import { query } from '../database/postgres';

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

// Generate on-the-fly if missing to ensure zero-config functionality
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.log('[Push Service] VAPID keys missing in env. Generating temporary keys in-memory...');
  const keys = webpush.generateVAPIDKeys();
  vapidKeys = {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey
  };
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@yourdomain.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export const getVapidPublicKey = () => vapidKeys.publicKey;

export const saveSubscription = async (userId: string, subscription: any): Promise<void> => {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    throw new Error('Invalid subscription format');
  }

  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET
     p256dh = EXCLUDED.p256dh,
     auth = EXCLUDED.auth,
     created_at = CURRENT_TIMESTAMP`,
    [userId, endpoint, keys.p256dh, keys.auth]
  );
};

export const deleteSubscription = async (userId: string, endpoint: string): Promise<void> => {
  await query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
};

export const sendPushNotification = async (userId: string, payload: { title: string; body: string; url?: string }): Promise<void> => {
  const result = await query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  const subscriptions = result.rows;
  console.log(`[Push Service] Sending notification to ${subscriptions.length} devices for user ${userId}`);

  const promises = subscriptions.map(async (sub: any) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`[Push Service] Subscription expired (status: ${error.statusCode}). Deleting from DB.`);
        await deleteSubscription(userId, sub.endpoint);
      } else {
        console.error('[Push Service] Error sending notification:', error);
      }
    }
  });

  await Promise.all(promises);
};

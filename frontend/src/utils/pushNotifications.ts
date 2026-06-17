// Push notification helper utilities

const getBackendUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5001';
  const hostname = window.location.hostname;
  
  // Support Microsoft Dev Tunnels dynamically (e.g. mapping frontend *-5173 to backend *-5001)
  if (hostname.includes('devtunnels.ms')) {
    return window.location.origin.replace('-5173', '-5001');
  }
  
  return `http://${hostname}:5001`;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function checkNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser');
    return null;
  }

  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[Push Notification] Service Worker registered', registration);

    // Ensure service worker is active
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', (e) => {
          if ((e.target as any).state === 'activated') {
            resolve();
          }
        });
      });
    }

    // 2. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push Notification] Permission not granted');
      return null;
    }

    // 3. Get VAPID key from backend
    const backendUrl = getBackendUrl();
    const keyResponse = await fetch(`${backendUrl}/api/notifications/vapid-key`);
    const { publicKey } = await keyResponse.json();

    if (!publicKey) {
      throw new Error('No public key returned from backend');
    }

    // 4. Subscribe the user
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('[Push Notification] Subscribed successfully', subscription);

    // 5. Send subscription details to backend
    const response = await fetch(`${backendUrl}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscription),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription details to backend');
    }

    console.log('[Push Notification] Registered subscription on backend successfully');
    return subscription;
  } catch (error) {
    console.error('[Push Notification] Subscription error:', error);
    throw error;
  }
}

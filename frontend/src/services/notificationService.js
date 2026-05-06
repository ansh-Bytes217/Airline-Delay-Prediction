import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging, VAPID_KEY } from "../firebase";

/**
 * Request notification permission and get FCM token.
 * Returns the token string or null if denied/unsupported.
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return null;
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch (err) {
    console.warn("FCM token error:", err.message);
    return null;
  }
}

/**
 * Listen for foreground messages and call the handler.
 */
export async function onForegroundMessage(handler) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, handler);
}

/**
 * Trigger a local browser notification (no server needed for demo).
 * In production this would be sent via Firebase Admin SDK from the backend.
 */
export function showLocalNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });
  }
}

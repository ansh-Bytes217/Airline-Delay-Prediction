// Firebase Cloud Messaging Service Worker
// Must be at /public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDaosDY93AlbRfJrOZ04gHaQPoPOERka24",
  authDomain: "skypredict-c4532.firebaseapp.com",
  projectId: "skypredict-c4532",
  storageBucket: "skypredict-c4532.firebasestorage.app",
  messagingSenderId: "785553372551",
  appId: "1:785553372551:web:acd1c95dc8badaaa930f22",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'SkyPredict Alert', {
    body: body || 'You have a new flight alert.',
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    actions: [{ action: 'view', title: 'View Dashboard' }],
  });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/dashboard');
    })
  );
});



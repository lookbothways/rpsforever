// rps forever — service worker.
// Sole job: receive Firebase Cloud Messaging pushes while the page is in the
// background (or closed) and show a notification. We deliberately do NOT add
// offline/app-shell caching here — the game must always load fresh from the
// network, so a caching layer would do more harm than good.

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
importScripts('./firebase-config.js');

const BASE = self.registration.scope; // e.g. https://USER.github.io/rpsForever/

// ---------- Firebase Cloud Messaging ----------
if (self.RPS_CONFIG && self.RPS_CONFIG.firebase
    && !self.RPS_CONFIG.firebase.projectId.startsWith('REPLACE_ME')) {
  firebase.initializeApp(self.RPS_CONFIG.firebase);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const d = payload.data || {};
    return self.registration.showNotification(d.title || 'rps forever', {
      body:  d.body || 'Someone just entered the arena. Come play!',
      icon:  BASE + 'icons/icon-192.png',
      badge: BASE + 'icons/icon-192.png',
      tag:   'rps-' + Date.now(), // unique per push so each one dings
      renotify: true,
      data: { url: BASE }
    });
  });
}

// Belt-and-braces: handle raw push events too, in case onBackgroundMessage
// doesn't fire (browsers differ here).
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { data: { body: event.data.text() } }; }
  const d = payload.data || payload.notification || {};
  event.waitUntil(self.registration.showNotification(d.title || 'rps forever', {
    body:  d.body || 'Someone just entered the arena. Come play!',
    icon:  BASE + 'icons/icon-192.png',
    badge: BASE + 'icons/icon-192.png',
    tag:   'rps-' + Date.now(),
    renotify: true,
    data: { url: BASE }
  }));
});

// Tapping the notification focuses an open tab or opens the game.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || BASE;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(BASE) && 'focus' in c) return c.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

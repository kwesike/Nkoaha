// NkoAha Service Worker — Push Notification Handler
// Place this file at: public/sw.js

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(clients.claim());
});

self.addEventListener("push", e => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: "NkoAha", body: e.data.text() }; }

  const title   = payload.title || "NkoAha";
  const options = {
    body:    payload.body  || "You have a new notification.",
    icon:    payload.icon  || "/nkoaha-icon-192.png",
    badge:   payload.badge || "/nkoaha-icon-96.png",
    tag:     payload.tag   || "nkoaha-notification",
    data:    payload.data  || {},
    actions: payload.actions || [],
    vibrate: [200, 100, 200],
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = e.notification.data?.url || "/dashboard";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
// TradeVerse service worker.
// V1 scope: handle incoming push events + notification clicks. Backend
// push infra (VAPID + subscription store) lands in a later phase;
// until then the SW is used for locally-triggered notifications via
// registration.showNotification().

self.addEventListener("install", () => {
  // Activate immediately — no complex caching logic yet.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  /** @type {{ title?: string; body?: string; url?: string; tag?: string }} */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "TradeVerse";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.svg",
    badge: "/icon.svg",
    data: { url: payload.url || "/inbox" },
    tag: payload.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/inbox";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // ignore
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

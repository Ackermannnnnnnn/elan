/*
 * Service worker d'Élan.
 *  · Notifications : affiche les rappels et la fin de repos envoyés par le
 *    serveur, même écran verrouillé ; un toucher ouvre la bonne page.
 *  · Hors connexion : une page simple plutôt que l'erreur du navigateur.
 * Aucune donnée personnelle n'est mise en cache.
 */
const OFFLINE_CACHE = "elan-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("elan-") && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Pages uniquement : en cas d'échec réseau, la page « hors connexion ».
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => response || Response.error()),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Élan", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Élan";
  const options = {
    body: data.body || "",
    tag: data.tag || "elan",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    vibrate: [300, 150, 300],
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Fin de repos alors que l'application est à l'écran : le minuteur sonne
      // déjà, inutile d'ajouter une notification.
      const watching = clients.some(
        (client) => client.visibilityState === "visible" && client.focused,
      );
      if (options.tag === "elan-rest" && watching) return undefined;
      return self.registration.showNotification(title, options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          return client
            .focus()
            .then((focused) =>
              focused && "navigate" in focused ? focused.navigate(target.href) : undefined,
            );
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

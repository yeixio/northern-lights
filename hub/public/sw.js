// Makes the app installable and lets it open without a connection. The app's
// own files are cached as they load; calls to the sites are never cached here
// (the app keeps its own copy of the last feed).
const CACHE = "nl-hub-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: the network first, so updates show up; the cached app when offline.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // Built files have content hashes in their names, so a cached copy is always right.
  event.respondWith(
    caches.match(event.request).then((hit) => hit ?? fetch(event.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        void caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    })),
  );
});

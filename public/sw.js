/*
 * Dinik Diary service worker (Build Phase 13): makes the app open offline after the first visit.
 * All data lives in the browser (IndexedDB), so only the app's own files need caching:
 * - pages: network first (always fresh when online), the cached copy when offline;
 * - built files (/_next/static, hashed names), icons, fonts: cache first;
 * - everything else from this site: the cached copy at once, refreshed in the background.
 * Bump VERSION to drop old caches after a change to this file.
 */
const VERSION = "v1";
const CACHE = `dinik-${VERSION}`;

/** Every screen, cached on install so they all open offline. */
const PAGES = [
  "/",
  "/habits",
  "/activities",
  "/reports",
  "/phases",
  "/health",
  "/health/reports",
  "/settings",
  "/more",
  "/brand",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // One page failing (e.g. a flaky network) must not stop the rest.
      Promise.allSettled(PAGES.map((url) => cache.add(new Request(url, { cache: "reload" })))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("dinik-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icon") ||
  url.pathname.startsWith("/apple-icon") ||
  /\.(?:woff2?|png|svg|ico)$/.test(url.pathname);

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match("/"));
    return cached ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached ?? Response.error());
  return cached ?? fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // React Server Component data for in-app navigation: when it fails offline, Next.js falls back
  // to loading the page itself, which is served from the cache below.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

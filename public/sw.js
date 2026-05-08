// Scramjet service worker
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

let configLoaded = false;
let configLoadError = null;

// Pre-load config on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await scramjet.loadConfig();
        configLoaded = true;
        console.log("[sw] Config loaded successfully");
      } catch (err) {
        configLoadError = err;
        console.error("[sw] Config load failed:", err);
      }
      return self.clients.claim();
    })(),
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET requests to allow them through (might need buffering for POST/PUT)
  if (event.request.method !== "GET" && event.request.method !== "HEAD") {
    // Try to proxy, but fall back to normal fetch if it fails
    event.respondWith(
      (async () => {
        try {
          if (!configLoaded) {
            await scramjet.loadConfig();
            configLoaded = true;
          }
          if (scramjet.route(event)) {
            return await scramjet.fetch(event);
          }
        } catch (err) {
          console.error("[sw] Scramjet fetch error for", event.request.url, err);
        }
        return fetch(event.request);
      })(),
    );
  } else {
    event.respondWith(
      (async () => {
        try {
          // Ensure config is loaded
          if (!configLoaded && !configLoadError) {
            await scramjet.loadConfig();
            configLoaded = true;
          }
          
          if (scramjet.route(event)) {
            const response = await scramjet.fetch(event);
            return response;
          }
        } catch (err) {
          console.error("[sw] Scramjet error:", event.request.url, err);
        }
        
        // Fallback to normal fetch
        return fetch(event.request).catch(() => {
          return new Response("Network error", { status: 503 });
        });
      })(),
    );
  }
});

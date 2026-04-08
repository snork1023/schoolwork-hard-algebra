importScripts("/scram/scramjet.all.js");
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Load config once on SW startup
scramjet.loadConfig().catch(console.error);

self.addEventListener("fetch", (event) => {
  if (scramjet.route(event)) {
    event.respondWith(scramjet.fetch(event));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

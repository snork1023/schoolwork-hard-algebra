importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");

const sw = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      if (await sw.route(event)) {
        return await sw.fetch(event);
      }
      return await fetch(event.request);
    })()
  );
});
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function initProxy() {
  try {
    if (!("serviceWorker" in navigator)) return;

    // Register SW first and wait for it to be active
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    await new Promise<void>((resolve) => {
      if (reg.active) { resolve(); return; }
      const worker = reg.installing || reg.waiting;
      if (!worker) { resolve(); return; }
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
      });
      // Fallback timeout
      setTimeout(resolve, 3000);
    });

    // Init Scramjet controller
    const { ScramjetController } = $scramjetLoadController();
    const scramjet = new ScramjetController({
      files: {
        wasm: "/scram/scramjet.wasm.wasm",
        all: "/scram/scramjet.all.js",
        sync: "/scram/scramjet.sync.js",
      },
    });
    await scramjet.init("/sw.js");

    // Set up BareMux transport
    const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
    const connection = new BareMuxConnection("/baremux/worker.js");
    
    // Try epoxy first, fall back to libcurl
    const transports = [
      ["/baremux/epoxy.js", [{ wisp: "wss://wisp.mercurywork.shop/" }]],
      ["/baremux/libcurl.js", [{ wisp: "wss://wisp.mercurywork.shop/" }]],
    ] as const;

    for (const [path, opts] of transports) {
      try {
        await connection.setTransport(path, opts);
        console.log("[Scramjet] Transport set:", path);
        break;
      } catch {
        continue;
      }
    }
  } catch (err) {
    console.warn("[Scramjet] Proxy init failed (non-fatal):", err);
  }
}

// Init proxy in background, don't block render
initProxy();

createRoot(document.getElementById("root")!).render(<App />);

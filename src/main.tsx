import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize Scramjet proxy
(async () => {
  const { ScramjetController } = $scramjetLoadController();
  const scramjet = new ScramjetController({
    files: {
      wasm: "/scram/scramjet.wasm.wasm",
      all: "/scram/scramjet.all.js",
      sync: "/scram/scramjet.sync.js",
    },
  });
  scramjet.init();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }

  const { BareMuxConnection } = await import("@mercuryworkshop/bare-mux");
  const connection = new BareMuxConnection("/baremux/worker.js");
  await connection.setTransport("/baremux/epoxy.js", [{ wisp: "wss://wisp.mercurywork.shop/" }]);
})();

createRoot(document.getElementById("root")!).render(<App />);
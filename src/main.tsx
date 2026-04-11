import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register UV service worker on startup (non-blocking)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch((err) => console.warn("[UV] SW registration failed:", err));
}

createRoot(document.getElementById("root")!).render(<App />);
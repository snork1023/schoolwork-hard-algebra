import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/uv/uv.sw.js", { scope: "/uv/" })
    .catch((err) => console.warn("[UV] SW registration failed:", err));
}

createRoot(document.getElementById("root")!).render(<App />);

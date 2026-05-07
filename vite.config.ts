import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import wispPlugin from "./scripts/wisp-vite-plugin.mjs";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), wispPlugin({ path: "/wisp/" })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
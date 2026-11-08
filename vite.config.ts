import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { readFileSync } from "fs";
import wispPlugin from "./scripts/wisp-vite-plugin.mjs";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
);

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [tailwindcss(), react(), wispPlugin({ path: "/wisp/" })],
  optimizeDeps: {
    entries: ["index.html"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
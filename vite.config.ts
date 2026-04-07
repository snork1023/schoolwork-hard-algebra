import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { viteStaticCopy } from "vite-plugin-static-copy"; // ADD THIS

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    viteStaticCopy({                                         // ADD THIS BLOCK
      targets: [
        {
          src: "node_modules/@mercuryworkshop/scramjet/dist/*",
          dest: "scram",
        },
        {
          src: "node_modules/@mercuryworkshop/bare-mux/dist/*",
          dest: "baremux",
        },
      ],
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
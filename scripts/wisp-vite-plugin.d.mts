import type { Plugin } from "vite";

declare const wispPlugin: (options?: Record<string, any>) => Plugin;
export default wispPlugin;

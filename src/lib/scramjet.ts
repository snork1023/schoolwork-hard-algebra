/**
 * Scramjet client-side bootstrap.
 *
 * - Loads the Scramjet bundle into the page (via a <script> tag).
 * - Configures bare-mux to use the Epoxy transport over our local Wisp
 *   WebSocket endpoint at /wisp/.
 * - Registers the service worker and exposes a singleton ScramjetController
 *   used to encode proxied URLs.
 */

interface ScramjetControllerConfig {
  prefix: string;
  files: {
    wasm: string;
    all: string;
    sync: string;
  };
}

interface ScramjetControllerInstance {
  init: () => Promise<void>;
}

type ScramjetControllerConstructor = new (
  config: ScramjetControllerConfig,
) => ScramjetControllerInstance;

// Not instantiated directly in this file today, but declared so the global
// shape matches what the Scramjet bundle actually registers.
type ScramjetServiceWorkerConstructor = new (...args: unknown[]) => unknown;

declare global {
  interface Window {
    $scramjetLoadController?: () => { ScramjetController: ScramjetControllerConstructor };
    $scramjetVersion?: { build: string; version: string };
    $scramjetLoadWorker?: () => { ScramjetServiceWorker: ScramjetServiceWorkerConstructor };
  }
}

export const SCRAMJET_PREFIX = "/scramjet/";
const SCRAM_ASSETS = "/scram/";

const LOG_BUFFER_SIZE = 200;
const logBuffer: Array<{ level: string; message: string; timestamp: string }> = [];
let consoleCaptured = false;

function formatConsoleArg(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pushLog(level: string, args: unknown[]) {
  const message = args.map(formatConsoleArg).join(" ");
  logBuffer.push({ level, message, timestamp: new Date().toISOString() });
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function captureConsoleLogs() {
  if (consoleCaptured) return;
  consoleCaptured = true;

  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  console.log = (...args: unknown[]) => {
    pushLog("log", args);
    originalConsole.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    pushLog("warn", args);
    originalConsole.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    pushLog("error", args);
    originalConsole.error(...args);
  };
  console.info = (...args: unknown[]) => {
    pushLog("info", args);
    originalConsole.info(...args);
  };
  console.debug = (...args: unknown[]) => {
    pushLog("debug", args);
    originalConsole.debug(...args);
  };
}

let controllerPromise: Promise<ScramjetControllerInstance> | null = null;

interface LoadedScriptElement extends HTMLScriptElement {
  __loaded?: boolean;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<LoadedScriptElement>(
      `script[data-scram-src="${src}"]`,
    );
    if (existing) {
      if (existing.__loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`)),
      );
      return;
    }

    const s = document.createElement("script") as LoadedScriptElement;
    s.src = src;
    s.async = false;
    s.dataset.scramSrc = src;
    s.addEventListener("load", () => {
      s.__loaded = true;
      resolve();
    });
    s.addEventListener("error", () =>
      reject(new Error(`Failed to load ${src}`)),
    );
    document.head.appendChild(s);
  });
}

function buildWispUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/wisp/`;
}

interface BareMuxConnectionInstance {
  setTransport: (transportPath: string, options: unknown[]) => Promise<void>;
}

async function setupTransport(): Promise<void> {
  const bareMux = (await import(
    /* @vite-ignore */ `${SCRAM_ASSETS}bare-mux/index.mjs`
  )) as { BareMuxConnection: new (workerPath: string) => BareMuxConnectionInstance };
  const conn = new bareMux.BareMuxConnection(`${SCRAM_ASSETS}bare-mux/worker.js`);
  await conn.setTransport(`${SCRAM_ASSETS}epoxy/index.mjs`, [
    { wisp: buildWispUrl() },
  ]);
}

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  const reg = await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`, { scope: "/" });
  await navigator.serviceWorker.ready;

  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Service worker controller was not available after registration")),
        10000,
      );

      const onControllerChange = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
          clearTimeout(timeout);
          resolve();
        }
      };

      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    });
  }
}

async function initInternal(): Promise<ScramjetControllerInstance> {
  captureConsoleLogs();
  await registerServiceWorker();
  await loadScript(`${SCRAM_ASSETS}scramjet.all.js`);

  if (typeof window.$scramjetLoadController !== "function") {
    throw new Error("Scramjet bundle did not register loader");
  }

  const { ScramjetController } = window.$scramjetLoadController();
  const controller = new ScramjetController({
    prefix: SCRAMJET_PREFIX,
    files: {
      wasm: `${SCRAM_ASSETS}scramjet.wasm.wasm`,
      all: `${SCRAM_ASSETS}scramjet.all.js`,
      sync: `${SCRAM_ASSETS}scramjet.sync.js`,
    },
  });

  await controller.init();
  await setupTransport();
  return controller;
}

export function getScramjetLogs(): string[] {
  return logBuffer.map((entry) => `[${entry.timestamp}] [${entry.level}] ${entry.message}`);
}

export function initScramjet(): Promise<ScramjetControllerInstance> {
  if (!controllerPromise) {
    controllerPromise = initInternal().catch((err) => {
      controllerPromise = null;
      throw err;
    });
  }
  return controllerPromise;
}
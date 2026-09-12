/**
 * Scramjet client-side bootstrap.
 *
 * Scramjet is initialized only on the search page.
 * Its service worker is restricted to /search/ and will not
 * intercept requests from the rest of the application.
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

type ScramjetServiceWorkerConstructor = new (
  ...args: unknown[]
) => unknown;

declare global {
  interface Window {
    $scramjetLoadController?: () => {
      ScramjetController: ScramjetControllerConstructor;
    };

    $scramjetVersion?: {
      build: string;
      version: string;
    };

    $scramjetLoadWorker?: () => {
      ScramjetServiceWorker: ScramjetServiceWorkerConstructor;
    };
  }
}

export const SCRAMJET_PREFIX = "/scramjet/";
const SCRAM_ASSETS = "/scram/";
const SCRAMJET_SCOPE = "/search/";
const SCRAMJET_SERVICE_WORKER_VERSION = "1";

const LOG_BUFFER_SIZE = 200;

const logBuffer: Array<{
  level: string;
  message: string;
  timestamp: string;
}> = [];

let consoleCaptured = false;

let controllerPromise: Promise<ScramjetControllerInstance> | null = null;

interface LoadedScriptElement extends HTMLScriptElement {
  __loaded?: boolean;
}

interface BareMuxConnectionInstance {
  setTransport: (
    transportPath: string,
    options: unknown[],
  ) => Promise<void>;
}

function isSearchPage(): boolean {
  const pathname = window.location.pathname;

  return (
    pathname === "/search/" ||
    pathname.startsWith("/search/")
  );
}

function formatConsoleArg(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function pushLog(level: string, args: unknown[]): void {
  const message = args.map(formatConsoleArg).join(" ");

  logBuffer.push({
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function captureConsoleLogs(): void {
  if (consoleCaptured) {
    return;
  }

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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<LoadedScriptElement>(
      `script[data-scram-src="${src}"]`,
    );

    if (existing) {
      if (existing.__loaded) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), {
        once: true,
      });

      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );

      return;
    }

    const script = document.createElement(
      "script",
    ) as LoadedScriptElement;

    script.src = src;
    script.async = false;
    script.dataset.scramSrc = src;

    script.addEventListener(
      "load",
      () => {
        script.__loaded = true;
        resolve();
      },
      { once: true },
    );

    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );

    document.head.appendChild(script);
  });
}

function buildWispUrl(): string {
  const protocol =
    window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}/wisp/`;
}

async function setupTransport(): Promise<void> {
  const bareMux = (await import(
    /* @vite-ignore */
    `${SCRAM_ASSETS}bare-mux/index.mjs`
  )) as {
    BareMuxConnection: new (
      workerPath: string,
    ) => BareMuxConnectionInstance;
  };

  const connection = new bareMux.BareMuxConnection(
    `${SCRAM_ASSETS}bare-mux/worker.js`,
  );

  await connection.setTransport(
    `${SCRAM_ASSETS}epoxy/index.mjs`,
    [
      {
        wisp: buildWispUrl(),
      },
    ],
  );
}

/**
 * Finds and removes the old root-scoped Scramjet service worker.
 *
 * Run this once after deploying this change if the old worker was
 * previously registered with scope "/".
 */
export async function removeLegacyScramjetWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) {
    return false;
  }

  const registrations =
    await navigator.serviceWorker.getRegistrations();

  let removed = false;

  for (const registration of registrations) {
    const scopePathname = new URL(
      registration.scope,
    ).pathname;

    const scriptUrl =
      registration.active?.scriptURL ||
      registration.waiting?.scriptURL ||
      registration.installing?.scriptURL ||
      "";

    const isRootScopedScramjetWorker =
      scopePathname === "/" &&
      (
        scriptUrl.includes("/sw.js") ||
        scriptUrl.includes("scramjet")
      );

    if (isRootScopedScramjetWorker) {
      const didUnregister = await registration.unregister();

      if (didUnregister) {
        removed = true;
        console.info(
          "[Scramjet] Removed legacy root-scoped service worker.",
        );
      }
    }
  }

  return removed;
}

async function waitForServiceWorkerController(): Promise<void> {
  if (navigator.serviceWorker.controller) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );

      reject(
        new Error(
          "Service worker controller was not available after registration.",
        ),
      );
    }, 10000);

    function onControllerChange(): void {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );

      window.clearTimeout(timeout);
      resolve();
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );
  });
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service workers are not supported in this browser.",
    );
  }

  if (!isSearchPage()) {
    throw new Error(
      "Scramjet service worker registration is only allowed on /search/.",
    );
  }

  const registration = await navigator.serviceWorker.register(
    `/sw.js?v=${SCRAMJET_SERVICE_WORKER_VERSION}`,
    {
      scope: SCRAMJET_SCOPE,
    },
  );

  await registration.update();

  if (registration.active) {
    await waitForServiceWorkerController();
  } else {
    await navigator.serviceWorker.ready;
    await waitForServiceWorkerController();
  }

  return registration;
}

async function initInternal(): Promise<ScramjetControllerInstance> {
  if (!isSearchPage()) {
    throw new Error(
      "Scramjet can only be initialized on the search page.",
    );
  }

  captureConsoleLogs();

  await registerServiceWorker();

  await loadScript(`${SCRAM_ASSETS}scramjet.all.js`);

  if (typeof window.$scramjetLoadController !== "function") {
    throw new Error(
      "Scramjet bundle did not register its controller loader.",
    );
  }

  const { ScramjetController } =
    window.$scramjetLoadController();

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
  return logBuffer.map(
    (entry) =>
      `[${entry.timestamp}] [${entry.level}] ${entry.message}`,
  );
}

export function initScramjet(): Promise<ScramjetControllerInstance> {
  if (!isSearchPage()) {
    return Promise.reject(
      new Error(
        "initScramjet() was called outside the /search/ page.",
      ),
    );
  }

  if (!controllerPromise) {
    controllerPromise = initInternal().catch((error) => {
      controllerPromise = null;
      throw error;
    });
  }

  return controllerPromise;
}
import EpoxyTransport from "@mercuryworkshop/epoxy-transport";
import type { ScramjetConfig } from "@mercuryworkshop/scramjet";
import type { Controller } from "@mercuryworkshop/scramjet-controller";

const SCRAM_ASSETS = "/scram/";
const CONTROLLER_ASSETS = "/controller/";
export const SCRAMJET_PREFIX = "/search/scramjet/";
const SCRAMJET_SCOPE = "/search/";
const SCRAMJET_SERVICE_WORKER_VERSION = "2";

let controllerPromise: Promise<Controller> | null = null;

declare global {
  interface Window {
    $scramjet?: {
      defaultConfigDev: ScramjetConfig;
    };
    $scramjetController?: {
      Controller: typeof import("@mercuryworkshop/scramjet-controller").Controller;
      config: typeof import("@mercuryworkshop/scramjet-controller").config;
    };
  }
}

function isScramjetPage(): boolean {
  const pathname = window.location.pathname;
  return pathname === "/search" || pathname.startsWith("/search/") ||
    pathname === "/browser";
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-scram-src="${src}"]`,
    );

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load Scramjet asset: ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.scramSrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load Scramjet asset: ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorker> {
  if (registration.active?.state === "activated") {
    return Promise.resolve(registration.active);
  }

  const worker = registration.installing ?? registration.waiting;
  if (!worker) {
    return Promise.reject(
      new Error("No active Scramjet service worker was found."),
    );
  }

  if (worker.state === "activated") {
    return Promise.resolve(worker);
  }

  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.removeEventListener("statechange", onStateChange);
    };

    const onStateChange = () => {
      if (worker.state === "activated") {
        finish();
        resolve(worker);
      } else if (worker.state === "redundant") {
        finish();
        reject(
          new Error("Scramjet service worker failed to activate."),
        );
      }
    };

    worker.addEventListener("statechange", onStateChange);
    onStateChange();
  });
}

async function registerServiceWorker(): Promise<ServiceWorker> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }

  if (!isScramjetPage()) {
    throw new Error(
      "Scramjet can only be initialized on the search or browser page.",
    );
  }

  await removeLegacyScramjetWorker();

  const registration = await navigator.serviceWorker.register(
    `/sw.js?v=${SCRAMJET_SERVICE_WORKER_VERSION}`,
    {
      scope: SCRAMJET_SCOPE,
      type: "classic",
      updateViaCache: "none",
    },
  );

  await registration.update();
  return waitForActiveWorker(registration);
}

async function removeLegacyScramjetWorker(): Promise<void> {
  const registrations = await navigator.serviceWorker.getRegistrations();

  for (const registration of registrations) {
    const scopePath = new URL(registration.scope).pathname;
    const worker = registration.active ??
      registration.waiting ??
      registration.installing;
    const workerPath = worker
      ? new URL(worker.scriptURL).pathname
      : "";
    const isLegacyRegistration =
      (scopePath === "/" || scopePath === "/search") &&
      workerPath === "/sw.js";

    if (isLegacyRegistration) {
      await registration.unregister();
    }
  }
}

function buildWispUrl(): string {
  const protocol =
    window.location.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${window.location.host}/wisp/`;
}

async function initInternal(): Promise<Controller> {
  if (!isScramjetPage()) {
    throw new Error(
      "Scramjet can only be initialized on the search or browser page.",
    );
  }

  const serviceworker = await registerServiceWorker();
  await loadScript(`${SCRAM_ASSETS}scramjet.js`);
  await loadScript(`${CONTROLLER_ASSETS}controller.api.js`);

  const controllerApi = window.$scramjetController;
  if (!controllerApi) {
    throw new Error("Scramjet controller bundle did not initialize.");
  }

  const scramjetConfig = window.$scramjet?.defaultConfigDev;
  if (!scramjetConfig) {
    throw new Error("Scramjet bundle did not expose its default configuration.");
  }

  const controller = new controllerApi.Controller({
    serviceworker,
    transport: new EpoxyTransport({ wisp: buildWispUrl() }),
    config: {
      ...controllerApi.config,
      prefix: SCRAMJET_PREFIX,
      scramjetPath: `${SCRAM_ASSETS}scramjet.js`,
      injectPath: `${CONTROLLER_ASSETS}controller.inject.js`,
      wasmPath: `${SCRAM_ASSETS}scramjet.wasm`,
    },
    scramjetConfig,
  });

  await controller.wait();
  return controller;
}

export function initScramjet(): Promise<Controller> {
  if (!isScramjetPage()) {
    return Promise.reject(
      new Error(
        "initScramjet() was called outside the search or browser page.",
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

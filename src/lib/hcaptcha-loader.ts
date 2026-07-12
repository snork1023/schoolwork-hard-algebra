// src/lib/hcaptcha-loader.ts

interface HCaptchaRenderParams {
  sitekey: string;
  theme?: "light" | "dark";
  size?: "normal" | "compact" | "invisible";
  tabindex?: number;
  callback?: (token: string, ekey: string) => void;
  "expired-callback"?: () => void;
  "chalexpired-callback"?: () => void;
  "error-callback"?: (error: string) => void;
  "close-callback"?: () => void;
  "open-callback"?: () => void;
}

interface HCaptchaAPI {
  render: (container: string | HTMLElement, params: HCaptchaRenderParams) => string;
  execute: (widgetId?: string) => void;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string;
  getRespKey: (widgetId?: string) => string;
}

let loadPromise: Promise<HCaptchaAPI> | null = null;

declare global {
  interface Window {
    hcaptcha?: HCaptchaAPI;
    __hcaptchaOnLoad?: () => void;
  }
}

export function loadHCaptcha(): Promise<HCaptchaAPI> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("hCaptcha can only be loaded in the browser"));
  }

  if (window.hcaptcha) {
    return Promise.resolve(window.hcaptcha);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=__hcaptchaOnLoad";
    script.async = true;
    script.defer = true;

    window.__hcaptchaOnLoad = () => {
      const hcaptcha = window.hcaptcha;
      if (hcaptcha) {
        resolve(hcaptcha);
      } else {
        reject(new Error("hCaptcha API loaded but hcaptcha is not available"));
      }
    };

    script.onerror = () => {
      reject(new Error("Failed to load hCaptcha script"));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function waitForHCaptcha(): Promise<HCaptchaAPI> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("hCaptcha can only be loaded in the browser"));
  }

  if (window.hcaptcha) {
    return Promise.resolve(window.hcaptcha);
  }

  return loadHCaptcha();
}
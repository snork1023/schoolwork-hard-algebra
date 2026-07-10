// src/lib/hcaptcha-loader.ts
let loadPromise: Promise<any> | null = null;

declare global {
  interface Window {
    hcaptcha?: any;
    __hcaptchaOnLoad?: () => void;
  }
}

export function loadHCaptcha(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("hCaptcha can only be loaded in the browser"));
  }

  if ((window as Window).hcaptcha) {
    return Promise.resolve((window as Window).hcaptcha);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=__hcaptchaOnLoad";
    script.async = true;
    script.defer = true;

    (window as Window).__hcaptchaOnLoad = () => {
      const hcaptcha = (window as Window).hcaptcha;
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

export function waitForHCaptcha(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("hCaptcha can only be loaded in the browser"));
  }

  if ((window as Window).hcaptcha) {
    return Promise.resolve((window as Window).hcaptcha);
  }

  return loadHCaptcha();
}

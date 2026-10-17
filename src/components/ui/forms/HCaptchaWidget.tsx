import { useEffect, useRef } from "react";
import { loadHCaptcha, waitForHCaptcha } from "@/lib/hcaptcha-loader";

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITEKEY as string | undefined;

interface HCaptchaWidgetProps {
  theme: "light" | "dark";
  onToken: (token: string | null) => void;
  onError: (error: Error) => void;
}

export default function HCaptchaWidget({ theme, onToken, onError }: HCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef({ onToken, onError });

  useEffect(() => {
    callbacksRef.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const container = containerRef.current;

    if (!container) return;
    if (!HCAPTCHA_SITEKEY) {
      callbacksRef.current.onError(new Error("VITE_HCAPTCHA_SITEKEY is not configured."));
      return;
    }

    loadHCaptcha()
      .then(() => waitForHCaptcha())
      .then((hcaptcha) => {
        if (cancelled) return;

        widgetId = hcaptcha.render(container, {
          sitekey: HCAPTCHA_SITEKEY,
          theme,
          callback: (token) => callbacksRef.current.onToken(token),
          "expired-callback": () => callbacksRef.current.onToken(null),
          "error-callback": (error) => {
            callbacksRef.current.onToken(null);
            callbacksRef.current.onError(new Error(`hCaptcha failed: ${error}`));
          },
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          callbacksRef.current.onError(
            error instanceof Error ? error : new Error("Could not load hCaptcha."),
          );
        }
      });

    return () => {
      cancelled = true;
      if (widgetId !== null) {
        window.hcaptcha?.remove(widgetId);
      }
      container.replaceChildren();
    };
  }, [theme]);

  return <div ref={containerRef} className="flex min-h-[78px] justify-center" />;
}

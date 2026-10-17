import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, RotateCw, Home, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/buttons/button";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getTabCloakMetadata } from "@/providers/SettingsProvider";
import { decodeProxiedUrl } from "@/lib/searchProxy";
import { initScramjet } from "@/lib/scramjet";

const BrowserView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useUserSettings();

  const encodedUrl = searchParams.get("url") || "";
  const [loading, setLoading] = useState(true);
  const [addressBar, setAddressBar] = useState("");
  const [scramjetReady, setScramjetReady] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<Frame | null>(null);
  const syncHistoryAvailability = useCallback(() => {
    setCanGoBack(historyIndexRef.current > 0);
    setCanGoForward(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Ensure Scramjet is initialized on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initScramjet();
        if (!cancelled) {
          setScramjetReady(true);
          console.log("[browser] Scramjet initialized successfully");
        }
      } catch (err) {
        console.error("[browser] Scramjet init failed:", err);
        if (!cancelled) {
          setBrowserError("Failed to initialize proxy. Please refresh the page.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [displayUrl, setDisplayUrl] = useState("");

  useEffect(() => {
    if (encodedUrl && historyIndexRef.current === -1) {
      historyRef.current.push(encodedUrl);
      historyIndexRef.current = 0;
      syncHistoryAvailability();
    }
  }, [encodedUrl, syncHistoryAvailability]);

  useEffect(() => {
    if (!scramjetReady || !iframeRef.current || !encodedUrl) return;

    let cancelled = false;
    (async () => {
      try {
        const controller = await initScramjet();
        if (cancelled || !iframeRef.current) return;

        const iframe = iframeRef.current;
        const frame = frameRef.current?.element === iframe
          ? frameRef.current
          : controller.createFrame(iframe);
        frameRef.current = frame;

        const target = await decodeProxiedUrl(encodedUrl);
        if (cancelled) return;
        frame.go(target);
        setDisplayUrl(target);
        setLoading(true);
      } catch (err) {
        console.error("[browser] frame navigation failed:", err);
        if (!cancelled) {
          setBrowserError("Could not open this page. Try entering the URL again.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [encodedUrl, scramjetReady]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow || loading) return;

    const checkUrl = () => {
      try {
        const currentUrl = iframeRef.current?.contentWindow?.location.href;
        if (currentUrl && currentUrl !== displayUrl) {
          void decodeProxiedUrl(currentUrl).then((decodedUrl) => {
            setDisplayUrl(decodedUrl);
            setAddressBar(decodedUrl);
          }).catch((err: unknown) => {
            console.error("[browser] failed to decode current URL:", err);
          });
        }
      } catch {
        // Ignore errors accessing location
      }
    };

    const interval = setInterval(checkUrl, 500);
    return () => clearInterval(interval);
  }, [displayUrl, loading]);

  const hostname = (() => {
    try {
      return new URL(displayUrl).hostname;
    } catch {
      return displayUrl;
    }
  })();

  const goToUrl = async (rawUrl: string) => {
    let target = rawUrl.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = "https://" + target;
    }

    try {
      await initScramjet();

      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(target);
      historyIndexRef.current++;
      syncHistoryAvailability();

      navigate(`/browser?url=${encodeURIComponent(target)}`);
      setLoading(true);
      setDisplayUrl(target);
      setAddressBar("");
    } catch (err) {
      console.error("[browser] proxy init failed:", err);
      setBrowserError("Could not start the proxy. Try refreshing the page.");
    }
  };

  const goBack = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prev = historyRef.current[historyIndexRef.current];
      syncHistoryAvailability();
      navigate(`/browser?url=${encodeURIComponent(prev)}`);
      setLoading(true);
    }
  };

  const goForward = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const next = historyRef.current[historyIndexRef.current];
      syncHistoryAvailability();
      navigate(`/browser?url=${encodeURIComponent(next)}`);
      setLoading(true);
    }
  };

  useEffect(() => {
    const cloak = getTabCloakMetadata(settings);
    document.title = cloak.title;
    const existingIcon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (existingIcon) {
      existingIcon.href = cloak.favicon;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = cloak.favicon;
      document.head.appendChild(link);
    }
  }, [settings]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <div className="bg-card border-b border-border p-2 space-y-2">
        <div className="flex items-center gap-1">
          <div className="bg-muted text-foreground rounded-t-lg px-4 py-2 flex items-center gap-2 max-w-[200px]">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm truncate">{hostname}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack} disabled={!canGoBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goForward}
              disabled={!canGoForward}
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              className="h-8 w-8 px-0"
              onClick={() => {
                setLoading(true);
                frameRef.current?.reload();
              }}
            >
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("/")}
            >
              <Home className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-muted text-foreground flex-1 rounded-full px-4 py-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent text-sm outline-none truncate"
              placeholder="Enter URL..."
              value={addressBar || displayUrl}
              onChange={(e) => setAddressBar(e.target.value)}
              onFocus={() => setAddressBar(displayUrl)}
              onBlur={() => {
                if (!addressBar.trim()) setAddressBar("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") goToUrl(addressBar);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-background">
        {!scramjetReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Initializing proxy...</p>
            </div>
          </div>
        )}

        {browserError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
            <div className="text-center space-y-4 max-w-md">
              <p className="text-red-500 font-semibold">{browserError}</p>
              <Button onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
          </div>
        )}

        {loading && scramjetReady && !browserError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}

        {scramjetReady && !browserError && (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-top-navigation allow-downloads"
            onLoad={async () => {
              setLoading(false);
            }}
            onError={() => {
              console.error("[browser] iframe load error");
              setLoading(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BrowserView;

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { buildProxiedSearchUrl, SEARCH_ENGINES } from "@/lib/searchProxy";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const engine = searchParams.get("engine") || "duckduckgo";
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    if (!query) return;

    // Wait for SW to be active before loading proxy URL
    const checkSW = async () => {
  if (!("serviceWorker" in navigator)) {
    setError("Service workers are not supported in this browser.");
    return;
  }

  try {
    // Register (or get existing) SW — this is idempotent
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    // If already active, we're done
    if (reg.active) {
      setSwReady(true);
      return;
    }

    // Wait for installing/waiting worker to activate
    const worker = reg.installing || reg.waiting;
    if (worker) {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          setSwReady(true);
        }
      });
    }

    // Also poll as a fallback
    const interval = setInterval(async () => {
      const r = await navigator.serviceWorker.getRegistration("/");
      if (r?.active) {
        clearInterval(interval);
        setSwReady(true);
      }
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      if (!swReady) {
        setError("Proxy service worker failed to start. Try refreshing.");
      }
    }, 8000);
  } catch (err) {
    setError("Unable to initialize the proxy.");
  }
};

    checkSW();
  }, [query]);

  useEffect(() => {
    if (!swReady || !query) return;
    const url = buildProxiedSearchUrl(query, engine);
    setProxyUrl(url);
  }, [swReady, query, engine]);

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 flex items-center justify-center">
          <p className="text-muted-foreground">No search query provided.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="pt-16 flex flex-col flex-1">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/80">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground truncate flex-1">
            Searching: <span className="text-foreground font-medium">{query}</span>
            {" "}via {engine.charAt(0).toUpperCase() + engine.slice(1)}
          </span>
          {proxyUrl && (
            <Button variant="ghost" size="icon" asChild>
              <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
        </div>

        <div className="flex-1 relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3 p-6">
                <p className="text-destructive font-medium">{error}</p>
                <Button onClick={() => window.location.reload()}>Refresh Page</Button>
              </div>
            </div>
          )}

          {!error && !proxyUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Connecting to proxy...</p>
              </div>
            </div>
          )}

          {proxyUrl && (
            <iframe
              src={proxyUrl}
              className="w-full h-full border-0"
              title="Search Results"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;

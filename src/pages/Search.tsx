import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { buildSearchUrl } from "@/lib/searchProxy";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Search = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [swReady, setSwReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    if (!("serviceWorker" in navigator)) {
      setError("Service workers are not supported in this browser.");
      return;
    }

    let resolved = false;

    const activate = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        const markReady = () => {
          if (!resolved) {
            resolved = true;
            setSwReady(true);
          }
        };

        if (reg.active) {
          markReady();
          return;
        }

        const worker = reg.installing || reg.waiting;
        worker?.addEventListener("statechange", () => {
          if ((worker as ServiceWorker).state === "activated") {
            markReady();
          }
        });

        const poll = setInterval(async () => {
          const r = await navigator.serviceWorker.getRegistration("/");
          if (r?.active) {
            clearInterval(poll);
            markReady();
          }
        }, 150);

        setTimeout(() => {
          clearInterval(poll);
          if (!resolved) {
            setError("Proxy failed to start. Try refreshing the page.");
          }
        }, 7000);
      } catch {
        setError("Could not start the proxy. Try a different browser.");
      }
    };

    activate();
  }, [query]);

  useEffect(() => {
    if (swReady && query) {
      setProxyUrl(buildSearchUrl(query));
    }
  }, [swReady, query]);

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
            Searching:{" "}
            <span className="text-foreground font-medium">{query}</span>
          </span>
        </div>

        <div className="flex-1 relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3 p-6">
                <p className="text-destructive font-medium">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </div>
            </div>
          )}

          {!error && !proxyUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Connecting to proxy...
                </p>
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
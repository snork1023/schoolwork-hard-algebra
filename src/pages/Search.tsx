import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { buildSearchTarget, decodeProxiedUrl } from "@/lib/searchProxy";
import { initScramjet } from "@/lib/scramjet";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Home, RotateCw } from "lucide-react";

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as { query?: string } | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const query = state?.query || searchParams.get("q") || "";
  const [frameReady, setFrameReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editableUrl, setEditableUrl] = useState("");
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [displayUrl, setDisplayUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<Frame | null>(null);

  const navigateFrame = async (target: string) => {
    const controller = await initScramjet();
    const iframe = iframeRef.current;
    if (!iframe) {
      throw new Error("Search results frame is not available.");
    }

    const frame = frameRef.current?.element === iframe
      ? frameRef.current
      : controller.createFrame(iframe);
    frameRef.current = frame;
    frame.go(target);
    setFrameReady(true);
    setDisplayUrl(target);
  };

  const handleUrlSearch = async (urlToSearch: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const cleanUrl = buildSearchTarget(urlToSearch);
      await navigateFrame(cleanUrl);
      setEditableUrl("");
      setIsEditingUrl(false);
    } catch (err) {
      console.error("[search] proxy init failed:", err);
      setError(err instanceof Error ? err.message : "Could not start the proxy.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!query) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale search state before starting the new request
    setError(null);
    setFrameReady(false);
    setIsLoading(true);

    (async () => {
      try {
        const cleanUrl = buildSearchTarget(query);
        await navigateFrame(cleanUrl);
        if (!cancelled) {
          setCurrentUrl(cleanUrl);
        }
      } catch (err) {
        console.error("[search] proxy init failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start the proxy.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!iframeRef.current || !frameReady || isEditingUrl) return;

    const checkUrl = async () => {
      try {
        const iframeUrl = iframeRef.current?.contentWindow?.location.href;
        if (iframeUrl && iframeUrl !== currentUrl) {
          try {
            const decodedUrl = await decodeProxiedUrl(iframeUrl);
            setCurrentUrl(decodedUrl);
          } catch {
            // If decoding fails, use the iframe URL as-is
            setCurrentUrl(iframeUrl);
          }
        }
      } catch {
        // Ignore errors accessing iframe location
      }
    };

    const interval = setInterval(checkUrl, 500);
    return () => clearInterval(interval);
  }, [frameReady, currentUrl, isEditingUrl]);

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-20 flex items-center justify-center">
          <p className="text-muted-foreground">No search query provided.</p>
        </div>
      </div>
    );
  }

  const targetUrl = buildSearchTarget(query);

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="flex flex-col flex-1 h-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleUrlSearch(
                isEditingUrl ? editableUrl : displayUrl || currentUrl || targetUrl,
              )}
              disabled={isLoading}
              title="Reload"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground shadow-inner outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              placeholder="Enter a URL or search query..."
              value={isEditingUrl ? editableUrl : displayUrl || currentUrl || targetUrl}
              onFocus={() => {
                setEditableUrl(displayUrl || currentUrl || targetUrl);
                setIsEditingUrl(true);
              }}
              onChange={(e) => setEditableUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleUrlSearch(editableUrl);
                }
              }}
            />
          </div>

        </div>

        <div className="flex-1 relative h-full">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-xl text-center p-6 rounded-xl border border-border bg-card/80">
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {error.startsWith("Invalid link.")
                    ? "Enter a valid HTTP or HTTPS link, or a search phrase."
                    : "Search failed to start. Make sure the transport is running and try again."}
                </p>
              </div>
            </div>
          )}

          {!error && !frameReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Preparing search...</p>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            className="w-full h-full border-0"
            title="Search Results"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      </div>
    </div>
  );
};

export default Search;
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { buildSearchUrl, buildSearchTarget } from "@/lib/searchProxy";
import { getScramjetLogs } from "@/lib/scramjet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Home, Terminal } from "lucide-react";

const Search = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as { query?: string } | null) ?? null;
  const searchParams = new URLSearchParams(location.search);
  const query = state?.query || searchParams.get("q") || "";
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logRefresh, setLogRefresh] = useState(0);

  useEffect(() => {
    if (!query) return;

    let cancelled = false;
    setError(null);
    setProxyUrl(null);

    (async () => {
      try {
        const url = await buildSearchUrl(query);
        if (!cancelled) {
          setProxyUrl(url);
        }
      } catch (err) {
        console.error("[search] proxy init failed:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start the proxy.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (!proxyUrl) return;
    const interval = window.setInterval(() => setLogRefresh((value) => value + 1), 2000);
    return () => window.clearInterval(interval);
  }, [proxyUrl]);

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <div className="pt-20 flex items-center justify-center">
          <p className="text-muted-foreground">No search query provided.</p>
        </div>
      </div>
    );
  }

  const logs = getScramjetLogs();
  const targetUrl = buildSearchTarget(query);

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="flex flex-col flex-1 h-full">
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-slate-900/85 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="truncate rounded-full border border-border bg-slate-800/70 px-4 py-2 text-sm text-slate-100 shadow-inner">
              {targetUrl}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Terminal className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Scramjet logs</DialogTitle>
                  <DialogDescription>Runtime log output captured from Scramjet.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-3 text-sm">
                  <pre className="max-h-64 overflow-auto rounded-md border border-border bg-slate-950/90 p-3 text-xs text-slate-100">
                    {logs.length > 0 ? logs.join("\n") : "No Scramjet logs captured yet."}
                  </pre>
                  <p className="text-muted-foreground">
                    These are the actual Scramjet console logs captured during the search session.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 relative h-full">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-xl text-center p-6 rounded-xl border border-border bg-card/80">
                <p className="text-destructive font-medium">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Configure Scramjet with <code>VITE_SCRAMJET_HOST</code> and restart the app.
                </p>
              </div>
            </div>
          )}

          {!error && !proxyUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Preparing search...</p>
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
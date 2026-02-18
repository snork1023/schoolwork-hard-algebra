import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RotateCw, Home, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const BrowserView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const url = searchParams.get("url") || "";
  const browserType = localStorage.getItem("browserType") || "chrome";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [liveURL, setLiveURL] = useState<string>("");
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [useWayback, setUseWayback] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const fetchWebsite = async () => {
      if (!url) return;
      
      setError(false);
      setLoading(true);
      setLiveURL("");
      setHtmlContent("");
      try {
        const { data, error: fetchError } = await supabase.functions.invoke('fetch-website', {
          body: { url: useWayback ? `https://web.archive.org/web/${url}` : url }
        });

        if (fetchError) throw fetchError;

        if (data?.liveURL) {
          setLiveURL(data.liveURL);
          setError(false);
        } else if (data?.html) {
          setHtmlContent(data.html);
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching website:', err);
        setError(true);
        toast({
          title: "Failed to load website",
          description: "The website couldn't be loaded through the browser service.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWebsite();
  }, [url, useWayback, toast, reloadKey]);

  const getBrowserStyles = () => {
    switch (browserType) {
      case "firefox":
        return {
          topBar: "bg-[#38383d] dark:bg-[#38383d]",
          urlBar: "bg-[#474749] dark:bg-[#474749] text-white",
        };
      case "safari":
        return {
          topBar: "bg-[#f6f6f6] dark:bg-[#2d2d2d]",
          urlBar: "bg-white dark:bg-[#3d3d3d] text-foreground",
        };
      case "edge":
        return {
          topBar: "bg-[#e5e5e5] dark:bg-[#2d2d2d]",
          urlBar: "bg-white dark:bg-[#3d3d3d] text-foreground",
        };
      default: // chrome
        return {
          topBar: "bg-[#f1f3f4] dark:bg-[#202124]",
          urlBar: "bg-white dark:bg-[#303134] text-foreground",
        };
    }
  };

  const styles = getBrowserStyles();
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div className="h-screen flex flex-col">
      {/* Browser Chrome */}
      <div className={`${styles.topBar} border-b border-border p-2 space-y-2`}>
        {/* Tab Bar */}
        <div className="flex items-center gap-1">
          <div className={`${styles.urlBar} rounded-t-lg px-4 py-2 flex items-center gap-2 max-w-[200px]`}>
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm truncate">{hostname}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/")}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 px-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}
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

          {/* URL Bar */}
          <div className={`${styles.urlBar} flex-1 rounded-full px-4 py-2 flex items-center gap-2`}>
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm flex-1 truncate">{url}</span>
          </div>
        </div>
      </div>

      {/* Browser Content */}
      <div className="flex-1 relative bg-background">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center space-y-3 max-w-md px-6">
              <p className="text-sm text-muted-foreground">
                Failed to load website. Try loading an archived version or open directly.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={() => setUseWayback(true)}
                  variant="default"
                >
                  Load via Wayback Machine
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline">
                    Open directly
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
        {!loading && !error && (
          liveURL ? (
            <iframe
              src={liveURL}
              className="w-full h-full border-0"
              title="Interactive Browser"
              sandbox="allow-same-origin allow-scripts"
              allow="clipboard-read; clipboard-write"
            />
          ) : htmlContent ? (
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full border-0"
              title="Browser Content"
              sandbox="allow-same-origin allow-scripts"
            />
          ) : null
        )}
      </div>
    </div>
  );
};

export default BrowserView;

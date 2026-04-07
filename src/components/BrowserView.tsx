import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RotateCw, Home, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/hooks/useUserSettings";
import { SCRAMJET_PROXY_URL } from "@/lib/searchProxy";

const BrowserView = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useUserSettings();
  const url = searchParams.get("url") || "";
  const originalUrl = searchParams.get("original") || "";
  const browserType = settings.browserType;
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addressBar, setAddressBar] = useState("");

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [url]);

  // Try to extract the original URL from the scramjet URL or use the original param for display
  const displayUrl = (() => {
    try {
      if (originalUrl) {
        return originalUrl;
      }
      if (url.startsWith(SCRAMJET_PROXY_URL)) {
        return decodeURIComponent(url.slice(SCRAMJET_PROXY_URL.length));
      }
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        return 'Proxied Content';
      }
      return url;
    } catch {
      return url;
    }
  })();

  const hostname = (() => {
    try { return new URL(displayUrl).hostname; } catch { return displayUrl; }
  })();

  const getBrowserStyles = () => {
    switch (browserType) {
      case "firefox":
        return { topBar: "bg-[#38383d]", urlBar: "bg-[#474749] text-white" };
      case "safari":
        return { topBar: "bg-[#f6f6f6] dark:bg-[#2d2d2d]", urlBar: "bg-white dark:bg-[#3d3d3d] text-foreground" };
      case "edge":
        return { topBar: "bg-[#e5e5e5] dark:bg-[#2d2d2d]", urlBar: "bg-white dark:bg-[#3d3d3d] text-foreground" };
      default:
        return { topBar: "bg-[#f1f3f4] dark:bg-[#202124]", urlBar: "bg-white dark:bg-[#303134] text-foreground" };
    }
  };

  const handleAddressBarNavigate = () => {
    if (!addressBar.trim()) return;
    let targetUrl = addressBar.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }
    const scramjetUrl = SCRAMJET_PROXY_URL + encodeURIComponent(targetUrl);
    navigate(`/browser?url=${encodeURIComponent(scramjetUrl)}`);
    setAddressBar("");
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const styles = getBrowserStyles();

  return (
    <div className="h-screen flex flex-col">
      <div className={`${styles.topBar} border-b border-border p-2 space-y-2`}>
        <div className="flex items-center gap-1">
          <div className={`${styles.urlBar} rounded-t-lg px-4 py-2 flex items-center gap-2 max-w-[200px]`}>
            <Lock className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm truncate">{hostname}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 px-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled><ArrowLeft className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled><ArrowRight className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setLoading(true); setReloadKey((k) => k + 1); }}>
              <RotateCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
              <Home className="w-4 h-4" />
            </Button>
          </div>
          <div className={`${styles.urlBar} flex-1 rounded-full px-4 py-2 flex items-center gap-2`}>
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent text-sm outline-none truncate"
              placeholder="Enter URL..."
              defaultValue={displayUrl}
              value={addressBar || undefined}
              onChange={(e) => setAddressBar(e.target.value)}
              onFocus={(e) => { if (!addressBar && !url.startsWith('blob:')) setAddressBar(displayUrl); }}
              onBlur={() => { if (!addressBar.trim()) setAddressBar(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddressBarNavigate(); }}
              disabled={url.startsWith('blob:')}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 relative bg-background">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}
        <iframe
          key={reloadKey}
          src={url}
          className="w-full h-full border-0"
          title="Browser"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
};

export default BrowserView;

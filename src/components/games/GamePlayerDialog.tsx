import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Maximize, Home, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GamePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameUrl: string;
  gameName: string;
}

const GamePlayerDialog = ({ open, onOpenChange, gameUrl, gameName }: GamePlayerDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the proxy URL for the game
  useEffect(() => {
    if (open && gameUrl) {
      setLoading(true);
      setError(null);
      
      // Build the proxy URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const encodedUrl = encodeURIComponent(gameUrl);
      const proxyEndpoint = `${supabaseUrl}/functions/v1/game-proxy?url=${encodedUrl}`;
      
      setProxyUrl(proxyEndpoint);
      setLoading(false);
    }
  }, [open, gameUrl]);

  const handleReload = () => {
    setKey(prev => prev + 1);
  };

  const handleFullscreen = () => {
    const container = document.getElementById("game-container");
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleHome = () => {
    onOpenChange(false);
    setProxyUrl(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        id="game-container"
        className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 bg-background border-border"
      >
        {/* Control Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <span className="font-medium text-foreground">{gameName}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReload}
              title="Reload"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFullscreen}
              title="Fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleHome}
              title="Close"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Game iframe */}
        <div className="flex-1 w-full h-[calc(90vh-52px)] bg-black flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-4 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Loading {gameName}...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 text-white text-center p-4">
              <span className="text-red-400">Failed to load game</span>
              <span className="text-sm text-muted-foreground">{error}</span>
              <Button variant="outline" onClick={handleReload}>
                Try Again
              </Button>
            </div>
          ) : proxyUrl ? (
            <iframe
              key={key}
              ref={iframeRef}
              src={proxyUrl}
              className="w-full h-full border-0"
              allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GamePlayerDialog;

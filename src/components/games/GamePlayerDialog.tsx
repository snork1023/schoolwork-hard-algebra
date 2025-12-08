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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchGame = async () => {
    if (!gameUrl) return;
    
    setIsLoading(true);
    setError(null);
    setLiveUrl(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-website', {
        body: { url: gameUrl }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.liveURL) {
        setLiveUrl(data.liveURL);
      } else {
        throw new Error('Failed to load game');
      }
    } catch (err) {
      console.error('Error fetching game:', err);
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && gameUrl) {
      fetchGame();
    } else {
      setLiveUrl(null);
      setError(null);
    }
  }, [open, gameUrl]);

  const handleReload = () => {
    fetchGame();
  };

  const handleFullscreen = () => {
    const container = document.getElementById("game-container");
    if (container) {
      if (!document.fullscreenElement) {
        container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const handleHome = () => {
    onOpenChange(false);
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
              disabled={isLoading}
              title="Reload"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
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

        {/* Game Content */}
        <div className="flex-1 w-full h-[calc(90vh-52px)] bg-black">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Loading {gameName}...</span>
              </div>
            </div>
          )}
          
          {error && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4 text-destructive">
                <span>{error}</span>
                <Button variant="outline" onClick={handleReload}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {liveUrl && !isLoading && !error && (
            <iframe
              ref={iframeRef}
              src={liveUrl}
              className="w-full h-full border-0"
              allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GamePlayerDialog;

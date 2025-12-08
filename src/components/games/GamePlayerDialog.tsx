import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Maximize, Home, X } from "lucide-react";

interface GamePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameUrl: string;
  gameName: string;
}

const GamePlayerDialog = ({ open, onOpenChange, gameUrl, gameName }: GamePlayerDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleReload = () => {
    if (iframeRef.current) {
      iframeRef.current.src = gameUrl;
    }
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
              title="Reload"
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
        <div className="flex-1 w-full h-[calc(90vh-52px)] bg-black">
          <iframe
            ref={iframeRef}
            src={gameUrl}
            className="w-full h-full border-0"
            allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GamePlayerDialog;

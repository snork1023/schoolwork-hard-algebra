import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Maximize, Minimize, Home } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface GamePlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameUrl: string;
  gameName: string;
}

const GamePlayerDialog = ({ open, onOpenChange, gameUrl, gameName }: GamePlayerDialogProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        id="game-container"
        className={`p-0 gap-0 bg-background border-border ${
          isFullscreen 
            ? 'w-screen h-screen max-w-none' 
            : 'max-w-[95vw] w-[95vw] h-[90vh]'
        }`}
      >
        {/* Control Bar */}
        <div className={`flex items-center justify-between px-4 py-2 border-b border-border bg-card ${
          isFullscreen ? 'hidden' : ''
        }`}>
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
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
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
        <div className={`bg-black ${
          isFullscreen 
            ? 'w-full h-full' 
            : 'flex-1 w-full h-[calc(90vh-52px)]'
        }`}>
          <iframe
            key={key}
            ref={iframeRef}
            src={gameUrl}
            className="w-full h-full border-0"
            {...(gameName === 'Spacewaves' ? {} : {
              sandbox: "allow-same-origin allow-scripts allow-popups allow-pointer-lock allow-orientation-lock allow-forms allow-downloads"
            })}
            allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope; gamepad"
            allowFullScreen
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GamePlayerDialog;

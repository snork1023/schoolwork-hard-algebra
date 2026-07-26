import { useState, useRef, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Maximize, Minimize, X } from "lucide-react";
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

  const handleFullscreen = async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      if (!document.fullscreenElement) {
        await iframe.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleHome = () => {
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        />
        <DialogPrimitive.Content
          id="game-container"
          className={`fixed left-[50%] top-[50%] z-50 grid translate-x-[-50%] translate-y-[-50%] gap-0 border border-border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg ${
            isFullscreen
              ? 'w-screen h-screen max-w-none rounded-none'
              : 'max-w-[95vw] w-[95vw] h-[90vh]'
          }`}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>{gameName}</DialogPrimitive.Title>
          </VisuallyHidden>

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
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Game iframe */}
          <div className={`bg-black ${
            isFullscreen
              ? 'w-full h-full'
              : 'flex-1 w-full h-[calc(90vh-52px)]'
          }`}>
            {gameUrl && (
              <iframe
                key={key}
                ref={iframeRef}
                src={gameUrl}
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-pointer-lock allow-orientation-lock allow-forms allow-downloads allow-modals allow-top-navigation-by-user-activation"
                allow="fullscreen; autoplay; clipboard-write; accelerometer; gyroscope; gamepad; cross-origin-isolated"
                allowFullScreen
              />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default GamePlayerDialog;
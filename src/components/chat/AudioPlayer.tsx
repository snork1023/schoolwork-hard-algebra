import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  duration?: number;
  isSender?: boolean;
}

export const AudioPlayer = ({
  src,
  duration: initialDuration,
  isSender = true,
}: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Audio playback failed:", error);
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;

    if (!audio || !duration || !Number.isFinite(duration)) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width)
    );

    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const progress =
    duration > 0
      ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
      : 0;

  const displayTime =
    currentTime > 0 || isPlaying
      ? formatTime(currentTime)
      : formatTime(duration);

  const containerClass = isSender
    ? "bg-primary text-primary-foreground rounded-br-xs"
    : "bg-muted/90 text-foreground rounded-bl-xs border border-border/20";

  const buttonClass = isSender
    ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
    : "bg-background text-foreground hover:bg-background/80";

  const trackClass = isSender
    ? "bg-primary-foreground/25"
    : "bg-muted-foreground/20";

  const progressClass = isSender
    ? "bg-primary-foreground"
    : "bg-primary";

  return (
    <div className="flex w-full justify-center">
      <div
        className={`flex w-[235px] items-center gap-3 rounded-3xl px-3.5 py-2.5 shadow-xs transition-all ${containerClass}`}
      >
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={isLoading}
          onClick={togglePlay}
          className={`h-8 w-8 shrink-0 rounded-full p-0 transition-transform active:scale-95 ${buttonClass}`}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            tabIndex={0}
            onClick={handleSeek}
            className="group relative flex h-6 min-w-0 flex-1 cursor-pointer items-center"
          >
            <div
              className={`absolute left-0 right-0 h-1.5 overflow-hidden rounded-full ${trackClass}`}
            >
              <div
                className={`h-full rounded-full ${progressClass}`}
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div
              className={`absolute h-3.5 w-3.5 rounded-full shadow-sm transition-transform group-hover:scale-110 ${progressClass}`}
              style={{
                left: `calc(${progress}% - 7px)`,
              }}
            />
          </div>

          <span className="shrink-0 select-none text-xs font-medium tabular-nums opacity-90">
            {displayTime}
          </span>
        </div>
      </div>
    </div>
  );
};

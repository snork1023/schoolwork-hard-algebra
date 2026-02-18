import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  duration?: number;
}

export const AudioPlayer = ({ src, duration: initialDuration }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate static waveform bars (deterministic based on src hash)
  const waveformBars = useMemo(() => {
    // Simple hash from src string for consistent waveform per file
    let hash = 0;
    for (let i = 0; i < src.length; i++) {
      hash = ((hash << 5) - hash) + src.charCodeAt(i);
      hash |= 0;
    }
    
    const bars: number[] = [];
    const barCount = 32;
    for (let i = 0; i < barCount; i++) {
      // Pseudo-random height based on hash + position
      const seed = Math.abs((hash * (i + 1)) % 100);
      const height = 0.2 + (seed / 100) * 0.6; // 20-80% height
      bars.push(height);
    }
    return bars;
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voice_message.${blob.type.split("/")[1] || "webm"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 min-w-[240px] max-w-[320px] p-3 rounded-2xl">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
        onClick={togglePlay}
        disabled={isLoading}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>

      {/* Waveform visualization */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="flex items-end gap-[2px] h-7 cursor-pointer group"
          onClick={handleSeek}
        >
          {waveformBars.map((height, index) => {
            const barProgress = index / waveformBars.length;
            const isPlayed = barProgress <= progress;

            return (
              <div
                key={index}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-75",
                  isPlayed
                    ? "bg-primary-foreground"
                    : "bg-primary-foreground/30 group-hover:bg-primary-foreground/50"
                )}
                style={{ height: `${Math.max(height * 100, 12)}%` }}
              />
            );
          })}
        </div>

        {/* Duration display */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-mono text-primary-foreground/70">
            {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0 rounded-full hover:bg-primary-foreground/10"
            onClick={handleDownload}
            title="Download voice message"
          >
            <Download className="h-3 w-3 text-primary-foreground/70" />
          </Button>
        </div>
      </div>
    </div>
  );
};

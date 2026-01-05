import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, ArrowUp, X, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";

interface VoiceRecorderInlineProps {
  conversationId: string;
  onClose: () => void;
  onSend: (file: { path: string; type: string; name: string; duration?: number }) => void;
}

export const VoiceRecorderInline = ({
  conversationId,
  onClose,
  onSend,
}: VoiceRecorderInlineProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(40).fill(0.15));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const { toast } = useToast();

  const updateVisualization = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const bars = 40;
    const step = Math.floor(dataArray.length / bars);
    const newData = [];
    for (let i = 0; i < bars; i++) {
      const value = dataArray[i * step] / 255;
      newData.push(Math.max(0.1, value * 0.9 + 0.1));
    }
    setWaveformData(newData);
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        const staticWaveform = Array.from({ length: 40 }, () => 
          Math.random() * 0.5 + 0.2
        );
        setWaveformData(staticWaveform);
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      updateVisualization();
    } catch (error) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice messages.",
        variant: "destructive",
      });
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const discardRecording = () => {
    stopRecording();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onClose();
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setPlaybackProgress(audioRef.current.currentTime / audioRef.current.duration);
        }
      };
    }
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const sendRecording = async () => {
    if (!audioBlob || !conversationId) return;
    
    setIsUploading(true);
    
    try {
      const fileName = `voice_${Date.now()}.webm`;
      const filePath = `${conversationId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(filePath, audioBlob);
      
      if (uploadError) throw uploadError;
      
      onSend({
        path: filePath,
        type: "audio/webm",
        name: fileName,
        duration,
      });
      
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      onClose();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-start recording when mounted
  useEffect(() => {
    startRecording();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-background/95 backdrop-blur-md flex items-center px-4 gap-3 rounded-2xl border border-border/30">
      {/* Cancel button - slide up text style */}
      <button
        onClick={discardRecording}
        className="text-destructive font-medium text-sm hover:text-destructive/80 transition-colors shrink-0"
      >
        Cancel
      </button>

      {/* Recording waveform / indicator */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {isRecording && !audioBlob && (
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        )}
        
        {/* Waveform visualization - Apple style bars */}
        <div 
          className={cn(
            "flex-1 flex items-center justify-center gap-[1.5px] h-10",
            audioBlob && "cursor-pointer hover:opacity-80"
          )}
          onClick={audioBlob ? togglePlayback : undefined}
        >
          {waveformData.map((value, index) => {
            const isPlayed = audioBlob && (index / waveformData.length) <= playbackProgress;
            
            return (
              <div
                key={index}
                className={cn(
                  "w-[3px] rounded-full transition-all duration-100",
                  isRecording && !audioBlob 
                    ? "bg-red-500" 
                    : isPlayed 
                      ? "bg-primary" 
                      : "bg-muted-foreground/30"
                )}
                style={{
                  height: `${Math.max(6, value * 32)}px`,
                }}
              />
            );
          })}
        </div>

        {/* Duration - Apple style */}
        <span className="text-sm font-medium text-foreground tabular-nums shrink-0 min-w-[40px]">
          {formatTime(duration)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {isRecording && !audioBlob ? (
          <button
            className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            onClick={stopRecording}
          >
            <Square className="h-3 w-3 fill-white text-white" />
          </button>
        ) : audioBlob ? (
          <>
            <button
              className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 text-foreground" />
              ) : (
                <Play className="h-3.5 w-3.5 text-foreground ml-0.5" />
              )}
            </button>
            
            <button
              className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors disabled:opacity-50"
              onClick={sendRecording}
              disabled={isUploading}
            >
              {isUploading ? (
                <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4 text-primary-foreground" />
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

// Legacy dialog-based recorder (kept for compatibility)
interface VoiceRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onRecordingComplete: (file: { path: string; type: string; name: string; duration?: number }) => void;
}

export const VoiceRecorder = ({
  open,
  onOpenChange,
  conversationId,
  onRecordingComplete,
}: VoiceRecorderProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md">
        <VoiceRecorderInline
          conversationId={conversationId}
          onClose={() => onOpenChange(false)}
          onSend={(file) => {
            onRecordingComplete(file);
            onOpenChange(false);
          }}
        />
      </div>
    </div>
  );
};

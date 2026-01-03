import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, Square, Send, Trash2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/error-utils";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [analyserData, setAnalyserData] = useState<number[]>(new Array(32).fill(0));
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const { toast } = useToast();

  const updateVisualization = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Sample 32 bars from the frequency data
    const bars = 32;
    const step = Math.floor(dataArray.length / bars);
    const newData = [];
    for (let i = 0; i < bars; i++) {
      newData.push(dataArray[i * step] / 255);
    }
    setAnalyserData(newData);
    
    if (isRecording && !isPaused) {
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    }
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Set up media recorder
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
        setAudioUrl(URL.createObjectURL(blob));
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
      
      // Start visualization
      updateVisualization();
    } catch (error) {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record voice messages.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setAnalyserData(new Array(32).fill(0));
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);
        updateVisualization();
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAnalyserData(new Array(32).fill(0));
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
      
      onRecordingComplete({
        path: filePath,
        type: "audio/webm",
        name: fileName,
        duration,
      });
      
      discardRecording();
      onOpenChange(false);
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

  // Cleanup on unmount or close
  useEffect(() => {
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
    };
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      stopRecording();
      discardRecording();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Message</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-6">
          {/* Visualization */}
          <div className="w-full h-24 flex items-center justify-center gap-1 bg-secondary/50 rounded-xl px-4">
            {analyserData.map((value, index) => (
              <div
                key={index}
                className="w-1.5 bg-primary rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(4, value * 80)}px`,
                  opacity: isRecording && !isPaused ? 0.5 + value * 0.5 : 0.3,
                }}
              />
            ))}
          </div>
          
          {/* Timer */}
          <div className="text-3xl font-mono font-bold text-foreground">
            {formatTime(duration)}
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-4">
            {!audioBlob ? (
              <>
                {!isRecording ? (
                  <Button
                    size="lg"
                    className="h-16 w-16 rounded-full"
                    onClick={startRecording}
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 w-12 rounded-full"
                      onClick={pauseRecording}
                    >
                      {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      className="h-16 w-16 rounded-full"
                      onClick={stopRecording}
                    >
                      <Square className="h-6 w-6" />
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-12 rounded-full"
                  onClick={discardRecording}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                
                {/* Preview playback */}
                <audio src={audioUrl || undefined} controls className="hidden" id="preview-audio" />
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-12 w-12 rounded-full"
                  onClick={() => {
                    const audio = document.getElementById("preview-audio") as HTMLAudioElement;
                    if (audio.paused) {
                      audio.play();
                    } else {
                      audio.pause();
                      audio.currentTime = 0;
                    }
                  }}
                >
                  <Play className="h-5 w-5" />
                </Button>
                
                <Button
                  size="lg"
                  className="h-16 w-16 rounded-full"
                  onClick={sendRecording}
                  disabled={isUploading}
                >
                  <Send className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
          
          {/* Status text */}
          <p className="text-sm text-muted-foreground">
            {isUploading
              ? "Uploading..."
              : isRecording
                ? isPaused
                  ? "Paused"
                  : "Recording..."
                : audioBlob
                  ? "Ready to send"
                  : "Tap to start recording"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
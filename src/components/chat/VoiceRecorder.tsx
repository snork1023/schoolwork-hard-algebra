import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, ArrowUp, X, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "@/components/ui/sonner";
import { getUserFriendlyError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";

type VoiceSendStep =
  | "init"
  | "mic_permission"
  | "recording"
  | "stopped"
  | "upload"
  | "db_insert"
  | "done"
  | "error";

type VoiceDebugEvent = {
  at: string;
  step: VoiceSendStep;
  message: string;
};

interface VoiceRecorderInlineProps {
  conversationId: string;
  onClose: () => void;
  onSend: (file: { path: string; type: string; name: string; duration?: number }) => void | Promise<void>;
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
  const [recordingMimeType, setRecordingMimeType] = useState<string>("audio/webm");
  const [recordingExt, setRecordingExt] = useState<string>("webm");

  // Debug panel: enabled in dev OR via URL/localStorage flag
  // - Add `?voice_debug=1` to the URL to enable without console access.
  // - Add `?voice_debug=0` to disable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("voice_debug");
    if (flag === "1") window.localStorage?.setItem("voice_debug", "1");
    if (flag === "0") window.localStorage?.removeItem("voice_debug");
  }, []);

  const debugEnabled =
    import.meta.env.DEV ||
    (typeof window !== "undefined" && window.localStorage?.getItem("voice_debug") === "1");
  const [debugStep, setDebugStep] = useState<VoiceSendStep>("init");
  const [debugEvents, setDebugEvents] = useState<VoiceDebugEvent[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { toast } = useToast();

  const notifyError = useCallback(
    (title: string, description: string) => {
      toast({ title, description, variant: "destructive" });
      // Fallback: if Radix toasts are not visible for any reason, Sonner is also mounted in App.
      sonnerToast.error(title, { description });
    },
    [toast]
  );

  const pushDebug = useCallback(
    (step: VoiceSendStep, message: string) => {
      if (!debugEnabled) return;
      setDebugStep(step);
      setDebugEvents((prev) => [
        ...prev.slice(-9),
        { at: new Date().toISOString(), step, message },
      ]);
    },
    [debugEnabled]
  );

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
      pushDebug("mic_permission", "Requesting microphone permission");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pushDebug("mic_permission", "Microphone granted");

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Prefer a supported mimeType (Safari/iOS often doesn't support audio/webm)
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];

      const chosenMime =
        preferredTypes.find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) ||
        "";

      const mimeType = chosenMime || "audio/webm";
      setRecordingMimeType(mimeType);

      const ext = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("mpeg")
          ? "mp3"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
      setRecordingExt(ext);

      const mediaRecorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (e: any) => {
        console.error("MediaRecorder error:", e);
        pushDebug("error", `MediaRecorder error: ${String(e?.message || e)}`);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        pushDebug(
          "stopped",
          `Recording stopped. blob=${Math.round(blob.size / 1024)}KB type=${mimeType}`
        );

        const staticWaveform = Array.from({ length: 40 }, () => Math.random() * 0.5 + 0.2);
        setWaveformData(staticWaveform);
      };

      mediaRecorder.start(100);
      pushDebug("recording", `Recording started (${mimeType})`);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      updateVisualization();
    } catch (error: any) {
      const desc = getUserFriendlyError(error);
      pushDebug("error", `Mic permission/recording failed: ${desc}`);
      setLastError(desc);
      notifyError("Couldn't start recording", desc);
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

    const fileName = `voice_${Date.now()}.${recordingExt}`;
    const filePath = `${conversationId}/${fileName}`;

    // Storage expects a standard MIME type; strip codecs params like ";codecs=opus".
    const baseMimeType = recordingMimeType.split(";")[0] || "audio/webm";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const authed = Boolean(session?.access_token);
      const userId = session?.user?.id;

      pushDebug("upload", `Auth session: ${authed ? "yes" : "no"}`);
      if (!authed || !userId) {
        throw new Error("Not signed in (no session). Please sign in again.");
      }

      // Preflight: ensure the current user is a participant in this conversation (matches storage policy)
      pushDebug("upload", `Preflight: checking conversation membership (${conversationId})`);
      const { data: membership, error: membershipError } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        throw new Error("You are not a participant in this conversation (upload not permitted).");
      }

      const payload = new File([audioBlob], fileName, { type: baseMimeType });

      pushDebug(
        "upload",
        `Uploading ${Math.round(payload.size / 1024)}KB → ${filePath} (${baseMimeType})`
      );
      if (debugEnabled) console.log("[VoiceRecorder] uploading", { filePath, baseMimeType, size: payload.size });

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(filePath, payload, {
          contentType: baseMimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      pushDebug("upload", "Upload OK");

      try {
        pushDebug("db_insert", "Inserting chat message row");
        // IMPORTANT: await parent send (DB insert). Only close UI if it succeeds.
        await onSend({
          path: filePath,
          type: baseMimeType.startsWith("audio/") ? baseMimeType : "audio/webm",
          name: fileName,
          duration,
        });
        pushDebug("done", "DB insert OK");
       } catch (dbError: any) {
         const desc = getUserFriendlyError(dbError);
         pushDebug("error", `DB insert failed: ${desc}`);
         setLastError(desc);
         notifyError("Voice message insert failed", desc);
         return;
       }

      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      onClose();
     } catch (uploadErr: any) {
       const desc = getUserFriendlyError(uploadErr);
       const status = uploadErr?.status || uploadErr?.cause?.status;
       const raw = (() => {
         try {
           return JSON.stringify(
             {
               name: uploadErr?.name,
               status,
               message: uploadErr?.message,
               details: uploadErr?.details,
               hint: uploadErr?.hint,
               code: uploadErr?.code,
             },
             null,
             0
           );
         } catch {
           return String(uploadErr);
         }
       })();

       const isAuth =
         status === 401 ||
         status === 403 ||
         /jwt|permission|auth/i.test(String(uploadErr?.message || ""));

       pushDebug("error", `Upload failed${status ? ` (${status})` : ""}: ${desc}`);
       pushDebug("error", `Upload raw: ${raw}`);
       setLastError(`${desc}${status ? ` (status ${status})` : ""}`);

       notifyError(
         isAuth ? "Voice upload blocked" : "Voice upload failed",
         isAuth
           ? `${desc} (This usually means you're signed out or don't have permission in this conversation.)`
           : desc
       );
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
    <div className="absolute inset-0 relative bg-background/95 backdrop-blur-md flex items-center px-4 gap-3 rounded-2xl border border-border/30">
      {/* Cancel button - slide up text style */}
      <button
        type="button"
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
            type="button"
            className="h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            onClick={stopRecording}
          >
            <Square className="h-3 w-3 fill-white text-white" />
          </button>
        ) : audioBlob ? (
          <>
            <button
              type="button"
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
              type="button"
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

      {(lastError || debugEnabled) && (
        <div className="absolute left-3 bottom-2 right-3 space-y-2">
          {lastError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">Voice upload failed</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground font-mono break-words">
                {lastError}
              </p>
            </div>
          )}

          {debugEnabled && (
            <div className="rounded-lg border border-border/40 bg-card/90 backdrop-blur px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-foreground">
                  Voice debug: <span className="font-mono">{debugStep}</span>
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {recordingMimeType.split(";")[0]}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={async () => {
                      const lines = [
                        `step: ${debugStep}`,
                        ...debugEvents.slice(-8).map((e) => `${e.step}: ${e.message}`),
                        lastError ? `error: ${lastError}` : "",
                      ].filter(Boolean);
                      try {
                        await navigator.clipboard.writeText(lines.join("\n"));
                        sonnerToast.success("Copied voice debug");
                      } catch {
                        sonnerToast.error("Couldn't copy", { description: "Clipboard permission denied." });
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="mt-1 space-y-0.5">
                {debugEvents.slice(-3).map((e) => (
                  <p key={e.at} className="text-[11px] text-muted-foreground font-mono truncate">
                    {e.step}: {e.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
          onSend={async (file) => {
            await onRecordingComplete(file);
            onOpenChange(false);
          }}
        />
      </div>
    </div>
  );
};

import { useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/lib/error-utils";
import { VoicePill, type VoicePillStopReason } from "./VoicePill";

type VoiceAttachment = {
  path: string;
  type: string;
  name: string;
  duration: number;
};

interface VoiceRecordProps {
  conversationId: string;
  onRecordingComplete: (file: VoiceAttachment) => void;
  disabled?: boolean;
}

const excludedStopReasons = new Set<VoicePillStopReason>([
  "cancel",
  "disabled",
  "blur",
  "mic-denied",
  "unmount",
]);

export const VoiceRecord = ({ conversationId, onRecordingComplete, disabled = false }: VoiceRecordProps) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stoppedRef = useRef<Promise<Blob> | null>(null);
  const resolveStoppedRef = useRef<((blob: Blob) => void) | null>(null);
  const mimeTypeRef = useRef("audio/webm");
  const { toast } = useToast();

  const handleStart = useCallback((stream: MediaStream) => {
    try {
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mimeTypeRef.current = recorder.mimeType || mimeType || "audio/webm";
      chunksRef.current = [];
      stoppedRef.current = new Promise(resolve => {
        resolveStoppedRef.current = resolve;
      });
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        resolveStoppedRef.current?.(blob);
        resolveStoppedRef.current = null;
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      throw error;
    }
  }, []);

  const handleStop = useCallback(async ({
    reason,
    duration,
  }: {
    reason: VoicePillStopReason;
    duration: number;
  }) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state !== "inactive") recorder.stop();
    const blob = await stoppedRef.current;
    mediaRecorderRef.current = null;
    stoppedRef.current = null;

    if (excludedStopReasons.has(reason)) return;
    if (!blob || blob.size === 0) {
      toast({
        title: "Recording is empty",
        description: "Record some audio before attaching a voice message.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data: membership, error: membershipError } = await supabase
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) throw new Error("You are not a participant in this conversation.");

      const extension = mimeTypeRef.current.includes("mp4")
        ? "m4a"
        : mimeTypeRef.current.includes("mpeg")
          ? "mp3"
          : mimeTypeRef.current.includes("ogg")
            ? "ogg"
            : "webm";
      const name = `voice_${Date.now()}.${extension}`;
      const path = `${conversationId}/${userId}/${name}`;
      const type = mimeTypeRef.current.split(";")[0] || "audio/webm";
      const file = new File([blob], name, { type });

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(path, file, { contentType: type, upsert: false });
      if (uploadError) throw uploadError;

      onRecordingComplete({ path, type, name, duration: Math.round(duration / 1000) });
    } catch (error: unknown) {
      toast({
        title: "Couldn't attach voice recording",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    }
  }, [conversationId, onRecordingComplete, toast]);

  return (
    <div className="order-1 flex h-9 w-9 shrink-0 items-center justify-center">
      <VoicePill
        disabled={disabled || !conversationId}
        onStart={handleStart}
        onStop={handleStop}
        onError={error => {
          toast({
            title: "Couldn't access microphone",
            description: getUserFriendlyError(error),
            variant: "destructive",
          });
        }}
      />
    </div>
  );
};

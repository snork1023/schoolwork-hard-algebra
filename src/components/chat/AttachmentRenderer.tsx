import { useState, useEffect } from "react";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AudioPlayer } from "./AudioPlayer";

interface Attachment {
  path?: string;
  url?: string;
  type: string;
  name: string;
  duration?: number;
}

interface AttachmentRendererProps {
  attachment: Attachment;
  onImageClick?: (url: string, name: string) => void;
}

// Signed URLs must be short-lived and generated fresh at render time.
// Do NOT cache or persist these anywhere (module scope, state that outlives
// the component, storage, etc.) — that would defeat the point of a
// short-lived URL for a private bucket.
const SIGNED_URL_EXPIRY_SECONDS = 60;

export const AttachmentRenderer = ({ attachment, onImageClick }: AttachmentRendererProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Legacy rows that only ever stored a public/direct URL (pre-migration
    // data). Nothing to sign here — just use what's there.
    if (attachment.url && !attachment.path) {
      setSignedUrl(attachment.url);
      return;
    }

    if (!attachment.path) {
      return;
    }

    const generateUrl = async () => {
      setLoading(true);
      setError(false);

      try {
        // supabase client here carries the caller's auth session, so the
        // signed URL is only ever minted for a request Storage/RLS has
        // already authorized against the private chat-attachments bucket.
        const { data, error: signError } = await supabase.storage
          .from("chat-attachments")
          .createSignedUrl(attachment.path!, SIGNED_URL_EXPIRY_SECONDS);

        if (signError) throw signError;

        if (!cancelled && data?.signedUrl) {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Failed to generate signed URL:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    generateUrl();

    return () => {
      cancelled = true;
    };
  }, [attachment.path, attachment.url]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-background/50 rounded text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span className="text-sm">{attachment.name} (unavailable)</span>
      </div>
    );
  }

  if (attachment.type.startsWith("image/")) {
    return (
      <img
        src={signedUrl}
        alt={attachment.name}
        className="rounded-lg max-w-xs max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => onImageClick?.(signedUrl, attachment.name)}
      />
    );
  }

  if (attachment.type.startsWith("video/")) {
    return (
      <video
        src={signedUrl}
        controls
        className="rounded-lg max-w-xs max-h-64"
      />
    );
  }

  if (attachment.type.startsWith("audio/")) {
    return (
      <AudioPlayer src={signedUrl} duration={attachment.duration} />
    );
  }

  return (
    <a
      href={signedUrl}
      download={attachment.name}
      className="flex items-center gap-2 p-2 bg-background/50 rounded hover:bg-background/80 transition-colors"
    >
      <FileText className="h-4 w-4" />
      <span className="text-sm">{attachment.name}</span>
    </a>
  );
};
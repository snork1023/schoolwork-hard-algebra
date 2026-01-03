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

// Cache for signed URLs
const urlCache = new Map<string, { url: string; expiry: number }>();
const URL_EXPIRY_SECONDS = 3600;

export const AttachmentRenderer = ({ attachment, onImageClick }: AttachmentRendererProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // If attachment has a direct URL (legacy data), use it
    if (attachment.url && !attachment.path) {
      setSignedUrl(attachment.url);
      return;
    }

    // If attachment has a path, generate signed URL
    if (attachment.path) {
      const generateUrl = async () => {
        // Check cache first
        const cached = urlCache.get(attachment.path!);
        const now = Date.now();
        
        if (cached && cached.expiry > now + 300000) {
          setSignedUrl(cached.url);
          return;
        }

        setLoading(true);
        setError(false);

        try {
          const { data, error: signError } = await supabase.storage
            .from("chat-attachments")
            .createSignedUrl(attachment.path!, URL_EXPIRY_SECONDS);

          if (signError) throw signError;

          if (data?.signedUrl) {
            urlCache.set(attachment.path!, {
              url: data.signedUrl,
              expiry: now + URL_EXPIRY_SECONDS * 1000,
            });
            setSignedUrl(data.signedUrl);
          }
        } catch (err) {
          console.error("Failed to generate signed URL:", err);
          setError(true);
        } finally {
          setLoading(false);
        }
      };

      generateUrl();
    }
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

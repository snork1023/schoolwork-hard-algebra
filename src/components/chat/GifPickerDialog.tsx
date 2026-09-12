import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";

interface GifPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGifSelect: (gifUrl: string, gifName: string) => void;
}

interface GifItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
}

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const value = error as {
    status?: unknown;
    context?: {
      status?: unknown;
    };
  };

  if (typeof value.context?.status === "number") {
    return value.context.status;
  }

  if (typeof value.status === "number") {
    return value.status;
  }

  return undefined;
};

export const GifPickerDialog = ({
  open,
  onOpenChange,
  onGifSelect,
}: GifPickerDialogProps) => {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke("klipy-gifs", {
            body: {
              query: search.trim(),
            },
          });

        if (functionError) {
          const status = getErrorStatus(functionError);

          if (status === 429) {
            throw new Error("RATE_LIMITED");
          }

          throw new Error(functionError.message);
        }

        if (!cancelled) {
          const results = Array.isArray(data?.gifs)
            ? data.gifs
            : [];

          setGifs(results);
        }
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load KLIPY GIFs:", err);

        setGifs([]);

        if (err instanceof Error && err.message === "RATE_LIMITED") {
          setError(
            "You’ve reached the GIF search limit. Please try again later.",
          );
        } else {
          setError("Couldn’t load GIFs. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  const handleGifClick = (gif: GifItem) => {
    if (!gif.url) return;

    onGifSelect(gif.url, gif.title || "GIF");

    onOpenChange(false);
    setSearch("");
  };

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value);

    if (!value) {
      setSearch("");
      setGifs([]);
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a GIF</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

          <Input
            placeholder="Search KLIPY"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[350px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-40 px-4 text-center text-muted-foreground">
              {error}
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              No GIFs found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1 pr-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleGifClick(gif)}
                  className="relative aspect-video overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={gif.thumbnail}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          Powered by KLIPY
        </p>
      </DialogContent>
    </Dialog>
  );
};
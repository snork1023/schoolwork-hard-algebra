import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export const GifPickerDialog = ({ open, onOpenChange, onGifSelect }: GifPickerDialogProps) => {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendingLoaded, setTrendingLoaded] = useState(false);

  const trimmed = useMemo(() => search.trim(), [search]);

  const fetchGifs = async (query: string) => {
    setLoading(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("gif-search", {
      body: { query },
    });

    if (fnError) throw new Error(fnError.message);

    const list = (data?.gifs ?? []) as GifItem[];
    setGifs(list);
  };

  const loadTrending = async () => {
    await fetchGifs("");
    setTrendingLoaded(true);
  };

  useEffect(() => {
    if (open && !trendingLoaded) {
      setSearch("");
      loadTrending().catch((e) => {
        console.error("Failed to load trending GIFs:", e);
        setError("Couldn’t load GIFs. Please try again.");
        setGifs([]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => {
      if (!trimmed) {
        loadTrending().catch((e) => {
          console.error("Failed to load trending GIFs:", e);
          setError("Couldn’t load GIFs. Please try again.");
          setGifs([]);
        });
        return;
      }

      fetchGifs(trimmed).catch((e) => {
        console.error("Failed to search GIFs:", e);
        setError("Search failed. Please try again.");
        setGifs([]);
      });
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, open]);

  const handleGifClick = (gif: GifItem) => {
    if (!gif.url) return;
    onGifSelect(gif.url, gif.title || "GIF");
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a GIF</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search GIFs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <div className="flex items-center justify-center h-40 text-muted-foreground text-center px-4">
              {error}
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">No GIFs found</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1 pr-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all"
                >
                  <img
                    src={gif.thumbnail}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">Powered by GIPHY</p>
      </DialogContent>
    </Dialog>
  );
};

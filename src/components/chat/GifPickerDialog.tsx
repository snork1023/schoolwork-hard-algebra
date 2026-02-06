import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";

interface GifPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGifSelect: (gifUrl: string, gifName: string) => void;
}

// Using Tenor API (free, no API key required for basic usage)
const TENOR_API_KEY = "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Public API key for demo

interface TenorGif {
  id: string;
  title: string;
  media_formats: {
    gif: { url: string };
    tinygif: { url: string };
  };
}

export const GifPickerDialog = ({ open, onOpenChange, onGifSelect }: GifPickerDialogProps) => {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoaded, setTrendingLoaded] = useState(false);

  // Load trending GIFs on open
  useEffect(() => {
    if (open && !trendingLoaded) {
      loadTrending();
    }
  }, [open]);

  const loadTrending = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=30&media_filter=gif,tinygif`
      );
      const data = await response.json();
      setGifs(data.results || []);
      setTrendingLoaded(true);
    } catch (error) {
      console.error("Failed to load trending GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      loadTrending();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?key=${TENOR_API_KEY}&q=${encodeURIComponent(query)}&limit=30&media_filter=gif,tinygif`
      );
      const data = await response.json();
      setGifs(data.results || []);
    } catch (error) {
      console.error("Failed to search GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        searchGifs(search);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleGifClick = (gif: TenorGif) => {
    const gifUrl = gif.media_formats.gif?.url || gif.media_formats.tinygif?.url;
    if (gifUrl) {
      onGifSelect(gifUrl, gif.title || "GIF");
      onOpenChange(false);
      setSearch("");
    }
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
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              No GIFs found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-1 pr-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all"
                >
                  <img
                    src={gif.media_formats.tinygif?.url || gif.media_formats.gif?.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          Powered by Tenor
        </p>
      </DialogContent>
    </Dialog>
  );
};

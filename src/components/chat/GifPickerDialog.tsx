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

interface RedditGif {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
}

export const GifPickerDialog = ({ open, onOpenChange, onGifSelect }: GifPickerDialogProps) => {
  const [search, setSearch] = useState("");
  const [gifs, setGifs] = useState<RedditGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoaded, setTrendingLoaded] = useState(false);

  useEffect(() => {
    if (open && !trendingLoaded) {
      loadTrending();
    }
  }, [open]);

  const loadTrending = async () => {
    setLoading(true);
    try {
      // Fetch trending GIFs from Reddit's r/gifs
      const response = await fetch(
        'https://www.reddit.com/r/gifs/hot.json?limit=30'
      );
      const data = await response.json();
      
      const gifResults = data.data.children
        .filter((post: any) => {
          const url = post.data.url?.toLowerCase() || '';
          return url.endsWith('.gif') || url.endsWith('.gifv') || url.includes('i.imgur.com');
        })
        .map((post: any) => ({
          id: post.data.id,
          title: post.data.title,
          url: post.data.url.replace('.gifv', '.gif'),
          thumbnail: post.data.thumbnail !== 'default' ? post.data.thumbnail : post.data.url,
        }))
        .slice(0, 20);

      setGifs(gifResults);
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
      // Search across multiple GIF subreddits
      const subreddits = ['gifs', 'reactiongifs', 'HighQualityGifs'];
      const searches = subreddits.map(sub =>
        fetch(`https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=10`)
          .then(r => r.json())
          .catch(() => ({ data: { children: [] } }))
      );

      const results = await Promise.all(searches);
      
      const allGifs = results.flatMap(data => 
        data.data.children
          .filter((post: any) => {
            const url = post.data.url?.toLowerCase() || '';
            return url.endsWith('.gif') || url.endsWith('.gifv') || url.includes('i.imgur.com');
          })
          .map((post: any) => ({
            id: post.data.id,
            title: post.data.title,
            url: post.data.url.replace('.gifv', '.gif'),
            thumbnail: post.data.thumbnail !== 'default' ? post.data.thumbnail : post.data.url,
          }))
      );

      // Remove duplicates and limit to 20
      const uniqueGifs = Array.from(
        new Map(allGifs.map(gif => [gif.id, gif])).values()
      ).slice(0, 20);

      setGifs(uniqueGifs);
    } catch (error) {
      console.error("Failed to search GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search) {
        searchGifs(search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleGifClick = (gif: RedditGif) => {
    if (gif.url) {
      onGifSelect(gif.url, gif.title || "GIF");
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
                    src={gif.thumbnail}
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
          GIFs from Reddit
        </p>
      </DialogContent>
    </Dialog>
  );
};
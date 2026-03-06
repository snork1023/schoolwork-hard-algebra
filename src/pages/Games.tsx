import { useState, useMemo, useCallback, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2, Gamepad2, Loader2 } from "lucide-react";
import { useSettingsContext } from "@/components/SettingsProvider";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomGame {
  id: string;
  name: string;
  iframe_src: string;
  added_by: string;
  created_at: string;
}

/** Extract the src URL from an iframe snippet, or treat raw URL as src */
const extractIframeSrc = (input: string): string | null => {
  const trimmed = input.trim();
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  const match = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const Games = () => {
  const { settings } = useSettingsContext();
  const [games, setGames] = useState<CustomGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIframe, setNewIframe] = useState("");

  const isDebug = settings.developerMode;

  // Get auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch games
  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase
        .from("custom_games")
        .select("*")
        .order("name");
      if (error) {
        console.error("Failed to load games", error);
      } else {
        setGames(data as CustomGame[]);
      }
      setLoading(false);
    };
    fetchGames();
  }, []);

  const filteredGames = useMemo(() => {
    return games.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, games]);

  const handleAddGame = useCallback(async () => {
    if (!userId) {
      toast.error("You must be logged in");
      return;
    }
    const name = newName.trim();
    if (!name || name.length > 100) {
      toast.error("Enter a valid game name (1-100 chars)");
      return;
    }
    const src = extractIframeSrc(newIframe);
    if (!src || !src.startsWith("https://")) {
      toast.error("Only valid HTTPS URLs are allowed");
      return;
    }

    setAdding(true);
    const { data, error } = await supabase
      .from("custom_games")
      .insert({ name, iframe_src: src, added_by: userId })
      .select()
      .single();
    setAdding(false);

    if (error) {
      toast.error("Failed to add game");
      console.error(error);
      return;
    }

    setGames(prev => [...prev, data as CustomGame].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName("");
    setNewIframe("");
    setAddDialogOpen(false);
    toast.success(`Added "${name}"`);
  }, [newName, newIframe, userId]);

  const handleDeleteGame = useCallback(async (id: string) => {
    const { error } = await supabase.from("custom_games").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove game");
      return;
    }
    setGames(prev => prev.filter(g => g.id !== id));
    toast.success("Game removed");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Search + Add */}
          <div className="flex items-center gap-3 mb-10 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search ${games.length} game${games.length !== 1 ? "s" : ""}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base bg-card/60 border-border/50 rounded-lg backdrop-blur-sm"
              />
            </div>
            {isDebug && userId && (
              <Button onClick={() => setAddDialogOpen(true)} size="lg" className="h-14 gap-2">
                <Plus className="h-5 w-5" />
                Add
              </Button>
            )}
          </div>

          {/* Game grid */}
          {loading ? (
            <div className="flex justify-center mt-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredGames.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
              {filteredGames.map(game => (
                <div key={game.id} className="group relative">
                  <button
                    onClick={() => setSelectedGame({ name: game.name, url: game.iframe_src })}
                    className="w-full aspect-[4/3] rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-muted flex items-center justify-center"
                    title={game.name}
                  >
                    <div className="flex flex-col items-center gap-2 p-2">
                      <Gamepad2 className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2 text-center">
                        {game.name}
                      </span>
                    </div>
                  </button>
                  {isDebug && userId && game.added_by === userId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGame(game.id); }}
                      className="absolute top-1 right-1 p-1 rounded bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove game"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground mt-12">
              {searchQuery
                ? `No games found matching "${searchQuery}"`
                : isDebug
                  ? "No games yet — click Add to embed one"
                  : "No games available"
              }
            </div>
          )}
        </div>
      </main>

      {/* Add Game Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Game</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Game"
                maxLength={100}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Iframe embed code or URL</label>
              <Textarea
                value={newIframe}
                onChange={(e) => setNewIframe(e.target.value)}
                placeholder='<iframe src="https://..." ...>'
                className="mt-1 min-h-[100px] font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGame} disabled={adding}>
              {adding && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GamePlayerDialog
        open={!!selectedGame}
        onOpenChange={(open) => !open && setSelectedGame(null)}
        gameUrl={selectedGame?.url || ""}
        gameName={selectedGame?.name || ""}
      />
    </div>
  );
};

export default Games;

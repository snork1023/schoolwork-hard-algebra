import { useState, useMemo, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, Plus, Trash2, Gamepad2 } from "lucide-react";
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

interface CustomGame {
  id: string;
  name: string;
  iframeSrc: string;
  addedAt: number;
}

const STORAGE_KEY = "debug_custom_games";

const loadCustomGames = (): CustomGame[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveCustomGames = (games: CustomGame[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
};

/** Extract the src URL from an iframe snippet, or treat raw URL as src */
const extractIframeSrc = (input: string): string | null => {
  const trimmed = input.trim();
  // If it looks like a URL already
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Try to pull src from iframe tag
  const match = trimmed.match(/src\s*=\s*["']([^"']+)["']/i);
  return match ? match[1] : null;
};

const Games = () => {
  const { settings } = useSettingsContext();
  const [customGames, setCustomGames] = useState<CustomGame[]>(loadCustomGames);
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIframe, setNewIframe] = useState("");

  const isDebug = settings.developerMode;

  const filteredGames = useMemo(() => {
    return customGames
      .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery, customGames]);

  const handleAddGame = useCallback(() => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a game name");
      return;
    }
    if (name.length > 100) {
      toast.error("Name must be under 100 characters");
      return;
    }
    const src = extractIframeSrc(newIframe);
    if (!src) {
      toast.error("Could not find a valid URL in the iframe code");
      return;
    }
    // Only allow https
    if (!src.startsWith("https://")) {
      toast.error("Only HTTPS URLs are allowed");
      return;
    }
    const game: CustomGame = {
      id: crypto.randomUUID(),
      name,
      iframeSrc: src,
      addedAt: Date.now(),
    };
    const updated = [...customGames, game];
    setCustomGames(updated);
    saveCustomGames(updated);
    setNewName("");
    setNewIframe("");
    setAddDialogOpen(false);
    toast.success(`Added "${name}"`);
  }, [newName, newIframe, customGames]);

  const handleDeleteGame = useCallback((id: string) => {
    const updated = customGames.filter(g => g.id !== id);
    setCustomGames(updated);
    saveCustomGames(updated);
    toast.success("Game removed");
  }, [customGames]);

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
                placeholder={`Search ${customGames.length} game${customGames.length !== 1 ? "s" : ""}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-base bg-card/60 border-border/50 rounded-lg backdrop-blur-sm"
              />
            </div>
            {isDebug && (
              <Button
                onClick={() => setAddDialogOpen(true)}
                size="lg"
                className="h-14 gap-2"
              >
                <Plus className="h-5 w-5" />
                Add
              </Button>
            )}
          </div>

          {/* Game grid */}
          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
              {filteredGames.map(game => (
                <div key={game.id} className="group relative">
                  <button
                    onClick={() => setSelectedGame({ name: game.name, url: game.iframeSrc })}
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
                  {isDebug && (
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
            <Button onClick={handleAddGame}>Add Game</Button>
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

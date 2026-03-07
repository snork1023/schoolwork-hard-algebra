import { useState, useEffect, useMemo } from "react";
import Navigation from "@/components/Navigation";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface GameEntry {
  folder: string;
  name: string;
}

const Games = () => {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/games/manifest.json")
      .then((res) => res.json())
      .then((data: GameEntry[]) => setGames(data))
      .catch(() => setGames([]));
  }, []);

  const filteredGames = useMemo(
    () => games.filter((g) => g.name.toLowerCase().includes(search.toLowerCase())),
    [games, search]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredGames.length === 0 && (
            <p className="text-center text-muted-foreground mt-12">No games found.</p>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
            {filteredGames.map((game) => (
              <button
                key={game.folder}
                onClick={() =>
                  setSelectedGame({
                    name: game.name,
                    url: `/games/${game.folder}/index.html`,
                  })
                }
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-muted"
                title={game.name}
              >
                <img
                  src={`/games/${game.folder}/thumb.png`}
                  alt={game.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-white text-xs font-semibold leading-tight line-clamp-2">{game.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

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
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";

interface GameEntry {
  folder: string;
  name: string;
}

const Games = () => {
  const [games, setGames] = useState<GameEntry[]>([]);
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/games/manifest.json")
      .then((res) => res.json())
      .then((data: GameEntry[]) => setGames(data))
      .catch(() => setGames([]));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          {games.length === 0 && (
            <p className="text-center text-muted-foreground mt-12">No games found. Add a folder to <code>public/games/</code> and update <code>manifest.json</code>.</p>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
            {games.map((game) => (
              <button
                key={game.folder}
                onClick={() =>
                  setSelectedGame({
                    name: game.name,
                    url: `/games/${game.folder}/index.html`,
                  })
                }
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-muted flex items-center justify-center"
                title={game.name}
              >
                <img
                  src={`/games/${game.folder}/thumb.png`}
                  alt={game.name}
                  className="w-3/4 h-3/4 object-contain"
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
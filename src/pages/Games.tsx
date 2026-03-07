import { useState } from "react";
import Navigation from "@/components/Navigation";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";

interface Game {
  name: string;
  url: string;
  thumb: string;
}

const games: Game[] = [
  {
    name: "2048",
    url: "https://play2048.co/",
    thumb: "https://play2048.co/meta/apple-touch-icon.png",
  },
];

const Games = () => {
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
            {games.map((game) => (
              <button
                key={game.name}
                onClick={() => setSelectedGame({ name: game.name, url: game.url })}
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-muted flex items-center justify-center"
                title={game.name}
              >
                <img
                  src={game.thumb}
                  alt={game.name}
                  className="w-3/4 h-3/4 object-contain"
                  loading="lazy"
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

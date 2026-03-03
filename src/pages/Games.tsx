import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";

// Import game icons
import slopeIcon from "@/assets/games/slope.png";
import game2048Icon from "@/assets/games/2048.png";
import tetrisIcon from "@/assets/games/tetris.png";
import snakeIcon from "@/assets/games/snake.png";
import pacmanIcon from "@/assets/games/pacman.png";
import minecraftIcon from "@/assets/games/minecraft.png";

interface Game {
  name: string;
  url: string;
  icon: string;
}

const games: Game[] = [{
  name: "Slope",
  url: "https://slope-game.github.io/",
  icon: slopeIcon
}, {
  name: "2048",
  url: "https://play2048.co/",
  icon: game2048Icon
}, {
  name: "Tetris",
  url: "https://tetris.com/play-tetris",
  icon: tetrisIcon
}, {
  name: "Snake",
  url: "https://playsnake.org/",
  icon: snakeIcon
}, {
  name: "Pac-Man",
  url: "https://www.google.com/logos/2010/pacman10-i.html",
  icon: pacmanIcon
}, {
  name: "Minecraft Classic",
  url: "https://classic.minecraft.net/",
  icon: minecraftIcon
}];

const Games = () => {
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    return games
      .filter(game => game.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Search bar like 55gms */}
          <div className="relative mb-10 max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Click here or type to search through our ${games.length} games!`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base bg-card/60 border-border/50 rounded-lg backdrop-blur-sm"
            />
          </div>

          {/* Grid of game tiles — image-only cards like 55gms */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5">
            {filteredGames.map(game => (
              <button
                key={game.name}
                onClick={() => setSelectedGame({ name: game.name, url: game.url })}
                className="group relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={game.name}
              >
                <img
                  src={game.icon}
                  alt={game.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Name overlay on hover */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-white text-xs font-semibold leading-tight line-clamp-2">{game.name}</span>
                </div>
              </button>
            ))}
          </div>

          {filteredGames.length === 0 && (
            <p className="text-center text-muted-foreground mt-12">No games found matching "{searchQuery}"</p>
          )}
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

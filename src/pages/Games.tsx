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

const games: Game[] = [
  { name: "Slope", url: "https://slope-game.github.io/", icon: slopeIcon },
  { name: "2048", url: "https://play2048.co/", icon: game2048Icon },
  { name: "Tetris", url: "https://tetris.com/play-tetris", icon: tetrisIcon },
  { name: "Snake", url: "https://playsnake.org/", icon: snakeIcon },
  { name: "Pac-Man", url: "https://www.google.com/logos/2010/pacman10-i.html", icon: pacmanIcon },
  { name: "Minecraft Classic", url: "https://classic.minecraft.net/", icon: minecraftIcon },
];

const Games = () => {
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => game.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />

      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Search Bar - 55gms style centered search */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Click here or type to search through our ${games.length} games!`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-6 text-base bg-background/50 border-border/50 rounded-xl placeholder:text-muted-foreground/70 focus:bg-background focus:border-primary/50 transition-all"
            />
          </div>
        </div>

        {/* Games Grid - 55gms style square cards */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredGames.map((game) => (
            <button
              key={game.name}
              onClick={() => setSelectedGame({ name: game.name, url: game.url })}
              className="group relative aspect-square rounded-xl overflow-hidden bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {/* Game Image - fills the card like 55gms */}
              <img
                src={game.icon}
                alt={game.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              
              {/* Game Name Overlay - appears on hover like 55gms */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-white text-xs font-medium line-clamp-2 text-center block">
                  {game.name}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredGames.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No games found matching "{searchQuery}"</p>
          </div>
        )}
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
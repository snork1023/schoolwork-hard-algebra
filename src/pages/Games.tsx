import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
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
        <div className="max-w-6xl mx-auto">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredGames.map(game => (
              <div
                key={game.name}
                onClick={() => setSelectedGame({ name: game.name, url: game.url })}
                className="group cursor-pointer"
              >
                <Card className="aspect-square bg-card border-border shadow-lg hover-glow transition-all group-hover:border-primary/50 flex flex-col items-center justify-center p-2">
                  <img 
                    src={game.icon} 
                    alt={game.name} 
                    className="h-20 w-20 mb-1 object-contain rounded-lg transition-transform duration-200 group-hover:scale-110"
                  />
                  <span className="text-xs font-medium text-center text-foreground">{game.name}</span>
                </Card>
              </div>
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
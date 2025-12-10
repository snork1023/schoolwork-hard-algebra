import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Gamepad2 } from "lucide-react";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";

const games = [{
  name: "Slope",
  description: "Roll down the slope and avoid obstacles",
  url: "https://slope-game.github.io/"
}, {
  name: "2048",
  description: "Combine tiles to reach 2048",
  url: "https://play2048.co/"
}, {
  name: "Tetris",
  description: "Classic block stacking game",
  url: "https://tetris.com/play-tetris"
}, {
  name: "Snake",
  description: "Classic snake game",
  url: "https://playsnake.org/"
}, {
  name: "Pac-Man",
  description: "Classic arcade game",
  url: "https://www.google.com/logos/2010/pacman10-i.html"
}, {
  name: "Minecraft Classic",
  description: "Play Minecraft in your browser",
  url: "https://classic.minecraft.net/"
}];

const Games = () => {
  const [selectedGame, setSelectedGame] = useState<{ name: string; url: string } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {games.map(game => (
              <div
                key={game.name}
                onClick={() => setSelectedGame({ name: game.name, url: game.url })}
                className="group cursor-pointer"
              >
                <Card className="aspect-square bg-card border-border shadow-lg hover-glow transition-all group-hover:border-primary/50 flex flex-col items-center justify-center p-3">
                  <Gamepad2 className="h-8 w-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-center text-foreground">{game.name}</span>
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
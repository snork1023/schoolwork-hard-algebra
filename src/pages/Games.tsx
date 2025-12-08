import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map(game => (
              <div
                key={game.name}
                onClick={() => setSelectedGame({ name: game.name, url: game.url })}
                className="group cursor-pointer"
              >
                <Card className="h-full bg-card border-border shadow-lg hover-glow transition-all group-hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      {game.name}
                      <Gamepad2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{game.description}</CardDescription>
                  </CardContent>
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
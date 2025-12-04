import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, ExternalLink } from "lucide-react";

const games = [
  {
    name: "Slope",
    description: "Roll down the slope and avoid obstacles",
    url: "https://slope-game.github.io/",
  },
  {
    name: "2048",
    description: "Combine tiles to reach 2048",
    url: "https://play2048.co/",
  },
  {
    name: "Tetris",
    description: "Classic block stacking game",
    url: "https://tetris.com/play-tetris",
  },
  {
    name: "Snake",
    description: "Classic snake game",
    url: "https://playsnake.org/",
  },
  {
    name: "Pac-Man",
    description: "Classic arcade game",
    url: "https://www.google.com/logos/2010/pacman10-i.html",
  },
  {
    name: "Minecraft Classic",
    description: "Play Minecraft in your browser",
    url: "https://classic.minecraft.net/",
  },
];

const Games = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold glow-text">Games</h1>
          </div>
          <p className="text-muted-foreground mb-8">
            Take a break and play some games
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <a
                key={game.name}
                href={game.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full bg-card border-border shadow-lg hover-glow transition-all group-hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      {game.name}
                      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{game.description}</CardDescription>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Games;

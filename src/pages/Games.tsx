import { useState, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import GamePlayerDialog from "@/components/games/GamePlayerDialog";

interface Game {
  name: string;
  gdId: string; // GameDistribution hash ID
}

// Games from GameDistribution — these are designed for iframe embedding
const games: Game[] = [
  { name: "Thread Sort", gdId: "b3432cc59437485f8239574bd4150856" },
  { name: "Cool SuperCars Stunts PvP", gdId: "c0ec7c50918143e8b7ba4b32282ed0e9" },
  { name: "Small Wardrobe", gdId: "b87d87d8b9954adf92f0aae4b9f28290" },
  { name: "Bubble Shooter Pro 4", gdId: "a2cd0ba0848b49b98ade7d2b8553f09d" },
  { name: "Goo Goo Gaga Clicker", gdId: "740fca628f4e499d95084c2d3c935acb" },
  { name: "Cake Merge", gdId: "1eabbe506bb743b48cda0dd4d7eef627" },
  { name: "M5 City Driver", gdId: "ce70177ea1894fcb9421898b1e56a290" },
  { name: "TapKO", gdId: "ac6a598abb184816af3be3acec546fb5" },
  { name: "Jewels Blitz Legends", gdId: "36cb9c95a60244d4899f6d79210e7f4d" },
  { name: "Slippery Drift Racing", gdId: "f312653358ec4c959a68e43bef2b72c6" },
  { name: "Farm Blast", gdId: "8e9f68b6765f4c39a4c243c4dc6a4ec5" },
  { name: "Racing Ball Adventure", gdId: "ddb44f5a2ab242969f0e5df218cb0640" },
  { name: "Avenger Guard", gdId: "c89b6590d54245c390eb27cc7d8048c9" },
  { name: "Tripeaks Solitaire Escapes", gdId: "c1337d45912e45b5be9666f08ba81963" },
  { name: "Snow Rider Obby Parkour", gdId: "1d74e75b8da74767938d3310255b4bd3" },
  { name: "Police Traffic Racer", gdId: "8748f54767044b99bc5373fc61596123" },
  { name: "Thread Match 2", gdId: "58e78963f24c4305931be1bffa305a19" },
  { name: "Daily Match", gdId: "a523b0c0ab444333b57347b6604f10c6" },
  { name: "Wood Block Puzzle 3", gdId: "a00735b23bde40798cfc095745212754" },
  { name: "Two Stunt Supercars", gdId: "b57c15d037024b798c2e80efbca087cc" },
  { name: "Sudoku Brain Blocks", gdId: "cd86994bb8a44da48354779bdc56e8f8" },
  { name: "Mojicon Love Connect", gdId: "6fb271b6c4164d22b10ab39e632c7747" },
  { name: "Challenger City Driver", gdId: "f38d251c8d8a4477aabde9953d8ac971" },
  { name: "Water Sort - Collections", gdId: "9ceb5732c253496e8589ac28574e0a81" },
  { name: "Crazy Tunnel", gdId: "dd2ab5adad664c508d3fa032bd19e8c8" },
  { name: "VegaMix Da Vinci Puzzles", gdId: "1a249236f03f474db586aeba1abafae0" },
  { name: "Luxury Highway Cars", gdId: "5439e7734cf14dd082fe993be28b99db" },
  { name: "Zombie Survival Shooter", gdId: "53ad84c4f3b440f2b65d5382fadf731f" },
  { name: "Obby Toilet Line", gdId: "27214a866f174c7ebdf0089d6b383d9f" },
  { name: "Winter Maze", gdId: "c07b3857103b41d5b3ca5ae0401027eb" },
  { name: "Wild West Match 3", gdId: "0f34626576354c7cb131c2e1fb4b8ae6" },
  { name: "Bubble Shooter: Spinner Pop", gdId: "e8e7f97933894e0c92422ec237d66d14" },
  { name: "Coin Stack Up", gdId: "64e5597f616e4d58960e3b263a286e15" },
  { name: "Gear Wars", gdId: "a6523a16099543ec804ed4057be06c0e" },
  { name: "Mojicon Fruit Connect", gdId: "b085b22a85384f558238432316e5ba32" },
  { name: "Kings and Queens Match 3", gdId: "15c88d1729174ebbae48fdd8e45d54e1" },
  { name: "Steal Brainrot Eggs", gdId: "e07da43b39e443738d6a84a4a6255c32" },
  { name: "Steal Brainrot Arena", gdId: "4592e84523ad49a8b80986c3aa503429" },
  { name: "Color Water Puzzle", gdId: "0ea7b7e7316a47c38ac5c98ddd42ec4a" },
  { name: "Survive The Night", gdId: "2a7a74f769ea40babd7d55ed7704af44" },
  { name: "Pinball VS Zombie", gdId: "5cdec698c5ce4e66af14ea5b3968ef08" },
  { name: "Catch a Fish Obby", gdId: "ac47a3b950d74509922e2c1724a4ed20" },
  { name: "Skillful Finger", gdId: "c7af7f58929a4a3c891ccf1192223a6a" },
  { name: "Crazy Bike Stunts PvP", gdId: "0c89181b9cfe4897afa41b0f94385da9" },
  { name: "Plant Merge: Zombie War", gdId: "9190c99d4aae4e0085a6059478ee3520" },
  { name: "Bubble Shooter Wild West", gdId: "0b18452cd7844e308b726bf05034fac2" },
  { name: "Crazy Traffic Racer", gdId: "d0b8e5ba257d4f888738a7ec722443f1" },
  { name: "Wave Dash: Geometry Arrow", gdId: "50d154abb6c5483b847cbeea848e73ff" },
  { name: "Obby Rainbow Tower", gdId: "57de0fa8b9fb4df783e7eb8248ac5e5a" },
];

const getGameThumb = (gdId: string) =>
  `https://img.gamedistribution.com/${gdId}-512x384.jpg`;

const getGameUrl = (gdId: string) =>
  `https://html5.gamedistribution.com/${gdId}/`;

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
          {/* Search bar */}
          <div className="relative mb-10 max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search through ${games.length} games...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-base bg-card/60 border-border/50 rounded-lg backdrop-blur-sm"
            />
          </div>

          {/* Grid of game tiles */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-3">
            {filteredGames.map(game => (
              <button
                key={game.gdId}
                onClick={() => setSelectedGame({ name: game.name, url: getGameUrl(game.gdId) })}
                className="group relative aspect-[4/3] rounded-lg overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={game.name}
              >
                <img
                  src={getGameThumb(game.gdId)}
                  alt={game.name}
                  className="w-full h-full object-cover bg-muted"
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

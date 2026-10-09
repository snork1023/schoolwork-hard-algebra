import ProxyInput from "@/components/home/ProxyInput";
import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";

const COOKIE_REVEALED_KEY = "kepler-secret-cookie-revealed";
const CONSTELLATION_SOLVED_KEY = "kepler-constellation-solved";
const SPLASH_CURSOR_ACTIVE_KEY = "kepler-splash-cursor-active";

const Index = () => {
  const features = [];
  const [subtextClicks, setSubtextClicks] = useState(0);
  const [isCookieRevealed, setIsCookieRevealed] = useState(
    () => window.localStorage.getItem(COOKIE_REVEALED_KEY) === "true",
  );
  const [isConstellationSolved, setIsConstellationSolved] = useState(
    () => window.localStorage.getItem(CONSTELLATION_SOLVED_KEY) === "true",
  );
  const [isSplashCursorActive, setIsSplashCursorActive] = useState(
    () => window.localStorage.getItem(SPLASH_CURSOR_ACTIVE_KEY) === "true",
  );
  const messages = [
    "dont click me",
    "click me (｡˃ ᵕ ˂ )",
    "this message is super rare",
    "if it doesn't work ur not worthy",
    "do it again",
    "good boy",
    "how bored must you be",
    "click me for a secret coin!",
    "good luck finding that coin",
    "ok thats enough",
    ":>",
    "UwU",
    "v1 was trash",
    "+1 cookie",
    "click me 10 times",
    "Japan is turning footsteps into electricity! Using piezoelectric tiles, every step you take generates a small amount of energy.",
    "who reads these anyway",
    "levi is the best at gd",
  ];

  const [messageIndex, setMessageIndex] = useState(() =>
  messages.length > 0
    ? Math.floor(Math.random() * messages.length)
    : 0
);

  const handleSubtextClick = () => {
    setMessageIndex(Math.floor(Math.random() * messages.length));
    const nextClicks = subtextClicks + 1;
    setSubtextClicks(nextClicks);
    if (nextClicks === 10) {
      window.localStorage.setItem(COOKIE_REVEALED_KEY, "true");
      setIsCookieRevealed(true);
    }
  };

  useEffect(() => {
    const handleConstellationSolved = () => setIsConstellationSolved(true);
    const handleSplashCursorState = (event: Event) => {
      setIsSplashCursorActive((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener("kepler-constellation-solved", handleConstellationSolved);
    window.addEventListener("kepler-splash-cursor-state", handleSplashCursorState);
    return () => {
      window.removeEventListener("kepler-constellation-solved", handleConstellationSolved);
      window.removeEventListener("kepler-splash-cursor-state", handleSplashCursorState);
    };
  }, []);

  const handleCookieClick = () => {
    if (window.localStorage.getItem(CONSTELLATION_SOLVED_KEY) === "true") {
      window.dispatchEvent(new Event("kepler-toggle-splash-cursor"));
      return;
    }
    window.dispatchEvent(new Event("kepler-site-dissolve"));
  };

  return <div className="min-h-screen">
      
      <main className="container mx-auto px-4 pt-32 pb-12">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4 text-foreground glow-text" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Kepler
          </h1>
          <button
            type="button"
            onClick={handleSubtextClick}
            className="block text-xl text-foreground/90 max-w-2xl mx-auto mb-6 cursor-pointer select-none bg-transparent border-0"
          >
            {messages[messageIndex]}
          </button>
          
        </div>

        <div className="mb-20 animate-fade-in">
          <ProxyInput />
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto animate-fade-in">
          {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div key={index} className="p-6 rounded-xl border border-border bg-card text-card-foreground">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          );
        })}
        </div>
      </main>
      {isCookieRevealed && (
        <button
          type="button"
          onClick={handleCookieClick}
          aria-label={
            isConstellationSolved
              ? `${isSplashCursorActive ? "Disable" : "Enable"} the splash cursor effect`
              : "Open the secret constellation"
          }
          aria-pressed={isConstellationSolved ? isSplashCursorActive : undefined}
          title={
            isConstellationSolved
              ? `${isSplashCursorActive ? "Disable" : "Enable"} the magic cursor`
              : "A secret constellation"
          }
          className="fixed bottom-5 right-5 z-40 grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-2xl shadow-lg transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Cookie aria-hidden="true" className="h-6 w-6 text-primary" />
        </button>
      )}
    </div>;
};
export default Index;

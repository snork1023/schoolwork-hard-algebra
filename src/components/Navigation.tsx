import { Link, useLocation } from "react-router-dom";
import { Home, Settings, MessageSquare, User, Sparkles, Gamepad2, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useFirebaseAuth, signOutFirebase } from "@/hooks/useFirebaseAuth";
import keplerLogo from "@/assets/kepler-logo.png";

const Navigation = () => {
  const location = useLocation();
  const { user, ready, configured } = useFirebaseAuth();
  const isLoggedIn = ready ? Boolean(user) : null;
  const { settings } = useUserSettings();
  const simpleMode = settings.simpleMode;

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await signOutFirebase();
    }
  };

  const links = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/games", icon: Gamepad2, label: "Games" },
    { to: "/chat", icon: Sparkles, label: "AI" },
    { to: "/community-chat", icon: MessageSquare, label: "Chat" },
    { to: "/account", icon: User, label: "Account" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={keplerLogo} alt="Kepler" className="w-10 h-10 transition-all duration-300 hover:drop-shadow-[0_0_8px_hsl(263,70%,65%)] cursor-pointer"/>
            <span
              className="text-lg sm:text-xl font-bold glow-text transition-all duration-300 hover:[text-shadow:0_0_20px_hsl(263,70%,65%),0_0_40px_hsl(263,70%,65%)] cursor-pointer" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Kepler
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {!simpleMode && <span className="hidden sm:inline" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.7rem", letterSpacing: "0.05em" }}>
                      {link.label}
                    </span>}
                  </Link>
                );
              })}
            </div>

            {configured ? (
              isLoggedIn === false ? (
                <Link
                  to="/community-chat"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all ml-2",
                    "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  title="Sign in"
                >
                  <LogIn className="w-4 h-4" />
                </Link>
              ) : isLoggedIn === true ? (
                <button
                  onClick={handleAuthAction}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              ) : null
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

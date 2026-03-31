import { Link, useLocation } from "react-router-dom";
import { Home, Settings, MessageSquare, User, Sparkles, Gamepad2, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/hooks/useUserSettings";

const Navigation = () => {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const { settings } = useUserSettings();
  const simpleMode = settings.simpleMode;

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await supabase.auth.signOut();
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);
  
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-lg sm:text-xl font-bold glow-text">
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
                    {!simpleMode && <span className="hidden sm:inline">{link.label}</span>}
                  </Link>
                );
              })}
            </div>

            {isLoggedIn === false ? (
              <Link
                to="/auth"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-all ml-2",
                  location.pathname === "/auth"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <LogIn className="w-4 h-4" />
              </Link>
            ) : isLoggedIn === true ? (
              <button
                onClick={handleAuthAction}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all ml-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

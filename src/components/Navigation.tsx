import { Link, useLocation, useNavigate } from "react-router";
import { Home, Settings, MessageSquare, User, Sparkles, Gamepad2, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import keplerLogo from "@/assets/kepler-logo.png";
import Dock from "@/components/Dock";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    { to: "/g", icon: Gamepad2, label: "Games" },
    { to: "/ai", icon: Sparkles, label: "Ai" },
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    { to: "/account", icon: User, label: "Account" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const dockItems = links.map((link) => ({
    icon: <link.icon className="w-5 h-5" />,
    label: link.label,
    onClick: () => navigate(link.to),
    className: location.pathname === link.to ? "bg-primary/20" : "",
  }));

  if (isLoggedIn === false) {
    dockItems.push({
      icon: <LogIn className="w-5 h-5" />,
      label: "Login",
      onClick: () => navigate("/auth"),
      className: location.pathname === "/auth" ? "bg-primary/20" : "",
    });
  } else if (isLoggedIn === true) {
    dockItems.push({
      icon: <LogOut className="w-5 h-5" />,
      label: "Logout",
      onClick: handleAuthAction,
      className: "",
    });
  }

  return (
    <nav className="fixed top-2 left-3 right-3 z-50">
      <div className="relative h-20 flex items-center">
        <div className="absolute left-0 top-1/2 -translate-y-[40%] flex items-center gap-2 pr-4 z-10 ml-8">
          <img src={keplerLogo} alt="Kepler" className="w-8 h-8 sm:w-9 sm:h-9" />
          <span
            className="text-sm sm:text-base font-semibold tracking-[0.2em] text-foreground"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            KEPLER
          </span>
        </div>
        <div className="flex-1 pr-14">
          <Dock
            items={dockItems}
            panelHeight={64}
            baseItemSize={46}
            magnification={68}
            distance={180}
            spring={{ mass: 0.1, stiffness: 150, damping: 12 }}
            className=""
          />
        </div>

        <div className="absolute right-6 top-1/2 -translate-y-[40%] z-20 mr-1">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center bg-transparent p-0"
            aria-label="Open navigation menu"
          >
            <div className="relative flex h-4 w-5 items-center justify-center">
              <span
                className={`absolute block h-0.5 w-5 rounded-full bg-foreground transition-all duration-200 dark:bg-white ${isMenuOpen ? "rotate-45" : "-translate-y-1"}`}
              />
              <span
                className={`absolute block h-0.5 w-5 rounded-full bg-foreground transition-all duration-200 dark:bg-white ${isMenuOpen ? "-rotate-45" : "translate-y-1"}`}
              />
            </div>
          </button>

          <div className={`absolute right-[-12px] top-full mt-4 w-44 overflow-hidden rounded-xl border border-border/70 bg-background/90 p-2 text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-md transition-all duration-200 ease-out dark:border-[#222] dark:bg-[#120F17] dark:text-white dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)] ${isMenuOpen ? "max-h-32 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"}`}>
            <Link
              to="/privacypolicy"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-primary/20 dark:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              to="/termsofservice"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-primary/20 dark:text-white"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;

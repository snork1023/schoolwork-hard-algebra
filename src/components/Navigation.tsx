import { Link, useLocation, useNavigate } from "react-router";
import { Home, Settings, MessageSquare, User, Sparkles, Gamepad2, LogIn, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
      </div>
    </nav>
  );
};

export default Navigation;

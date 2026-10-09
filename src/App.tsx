import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { SettingsProvider, useSettingsContext } from "@/components/providers/SettingsProvider";
import Background from "@/components/background/Background";
import Navigation from "@/components/layout/Navigation";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Ai from "./pages/Ai";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Account from "./pages/Account";
import Games from "./pages/Games";
import Search from "./pages/Search";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import BrowserView from "./components/browser/BrowserView";
import SiteDissolveEffect from "./components/easteregg/SiteDissolveEffect";
import SplashCursor from "./components/easteregg/SplashCursor";
import { isSignupInProgress } from "@/lib/signup-flow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const queryClient = new QueryClient();
const SPLASH_CURSOR_ACTIVE_KEY = "kepler-splash-cursor-active";

const SplashCursorGate = () => {
  const [isActive, setIsActive] = useState(
    () => window.localStorage.getItem(SPLASH_CURSOR_ACTIVE_KEY) === "true",
  );

  useEffect(() => {
    const setActive = (active: boolean) => {
      window.localStorage.setItem(SPLASH_CURSOR_ACTIVE_KEY, String(active));
      setIsActive(active);
      window.dispatchEvent(new CustomEvent("kepler-splash-cursor-state", { detail: active }));
    };
    const activate = () => setActive(true);
    const toggle = () => {
      setActive(window.localStorage.getItem(SPLASH_CURSOR_ACTIVE_KEY) !== "true");
    };
    window.addEventListener("kepler-show-splash-cursor", activate);
    window.addEventListener("kepler-toggle-splash-cursor", toggle);
    window.addEventListener("kepler-constellation-solved", activate);
    return () => {
      window.removeEventListener("kepler-show-splash-cursor", activate);
      window.removeEventListener("kepler-toggle-splash-cursor", toggle);
      window.removeEventListener("kepler-constellation-solved", activate);
    };
  }, []);

  return isActive ? <SplashCursor /> : null;
};

const Backgroundeffect = () => {
  const { settings } = useSettingsContext();
  if (!settings.showBackground) return null;
  return <Background />;
};

const DOCK_ENABLED_ROUTES = ["/", "/g", "/ai", "/chat", "/account", "/settings", "/auth"];

const NavigationGate = () => {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  if (!DOCK_ENABLED_ROUTES.includes(pathname)) return null;
  return <Navigation />;
};

const SignupRouteGuard = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldBlock = location.pathname !== "/auth" && isSignupInProgress();
  const showSignupReminder = location.state?.signupReminder === true;

  useEffect(() => {
    if (!shouldBlock) return;
    navigate("/auth", { replace: true, state: { signupReminder: true } });
  }, [navigate, shouldBlock]);

  return (
    <>
      {shouldBlock ? null : children}
      <AlertDialog
        open={showSignupReminder}
        onOpenChange={(open) => {
          if (!open) navigate("/auth", { replace: true, state: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish creating your account</AlertDialogTitle>
            <AlertDialogDescription>
              Complete account setup before leaving onboarding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Continue setup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Backgroundeffect />
            <NavigationGate />
            <SiteDissolveEffect />
            <SplashCursorGate />
            <div className="relative" style={{ zIndex: 1 }}>
            <SignupRouteGuard>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/g" element={<Games />} />
              <Route path="/ai" element={<Ai />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/browser" element={<BrowserView />} />
              <Route path="/search" element={<Search />} />
              <Route path="/privacypolicy" element={<PrivacyPolicy />} />
              <Route path="/termsofservice" element={<TermsOfService />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SignupRouteGuard>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
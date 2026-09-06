import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router";
import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { SettingsProvider, useSettingsContext } from "@/components/SettingsProvider";
import Background from "@/components/Background";
import Navigation from "@/components/Navigation";
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
import BrowserView from "./components/BrowserView";
import { isSignupInProgress } from "@/lib/signup-flow";

const queryClient = new QueryClient();

const Backgroundeffect = () => {
  const { settings } = useSettingsContext();
  if (!settings.showBackground) return null;
  return <Background />;
};

const DOCK_FREE_ROUTES = ["/browser", "/search", "/privacypolicy", "/termsofservice"];

const NavigationGate = () => {
  const location = useLocation();
  if (DOCK_FREE_ROUTES.includes(location.pathname)) return null;
  return <Navigation />;
};

const SignupRouteGuard = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const shouldBlock = location.pathname !== "/auth" && isSignupInProgress();

  useEffect(() => {
    if (!shouldBlock) return;
    window.alert("Account must first be created before you can leave signup.");
    window.history.replaceState(null, "", "/auth");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [shouldBlock]);

  if (shouldBlock) return null;
  return children;
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
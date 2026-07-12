import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SettingsProvider, useSettingsContext } from "@/components/SettingsProvider";
import ShootingStars from "@/components/ShootingStars";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Ai from "./pages/Ai";
import Auth from "./pages/Auth";
import CommunityChat from "./pages/CommunityChat";
import Account from "./pages/Account";
import Games from "./pages/Games";
import Search from "./pages/Search";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import BrowserView from "./components/BrowserView";

const queryClient = new QueryClient();

const GlobalStars = () => {
  const { settings } = useSettingsContext();
  if (!settings.showStars) return null;
  return <ShootingStars />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <GlobalStars />
            <div className="relative" style={{ zIndex: 1 }}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/g" element={<Games />} />
              <Route path="/ai" element={<Ai />} />
              <Route path="/chat" element={<CommunityChat />} />
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
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

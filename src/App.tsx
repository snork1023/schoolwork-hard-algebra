import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SettingsProvider } from "@/components/SettingsProvider";
import ShootingStars from "@/components/ShootingStars";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import Chat from "./pages/Chat";
import Auth from "./pages/Auth";
import CommunityChat from "./pages/CommunityChat";
import Account from "./pages/Account";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";
import BrowserView from "./components/BrowserView";

const queryClient = new QueryClient();

const GlobalStars = () => {
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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/games" element={<Games />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/community-chat" element={<CommunityChat />} />
              <Route path="/account" element={<Account />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/browser" element={<BrowserView />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

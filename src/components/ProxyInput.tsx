import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserSettings } from "@/hooks/useUserSettings";

const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  brave: "https://search.brave.com/search?q=",
};

const SCRAMJET_BASE = "https://scramjet.mercurywork.shop/";

const ProxyInput = () => {
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings } = useUserSettings();

  const handleSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Please enter a search query",
        description: "Enter something to search for",
        variant: "destructive",
      });
      return;
    }

    const engineBase = SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google;
    const searchUrl = engineBase + encodeURIComponent(query.trim());
    const scramjetUrl = SCRAMJET_BASE + encodeURIComponent(searchUrl);

    navigate(`/browser?url=${encodeURIComponent(scramjetUrl)}`);
    setQuery("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex gap-3">
        <Input
          type="text"
          placeholder={`Search with ${settings.searchEngine.charAt(0).toUpperCase() + settings.searchEngine.slice(1)}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyPress}
          className="flex-1 h-14 text-lg bg-card border-border focus:border-primary transition-all"
        />
        <Button
          onClick={handleSearch}
          className="h-14 px-8 bg-gradient-to-r from-primary to-accent hover-glow"
          size="lg"
        >
          <Search className="w-5 h-5 mr-2" />
          Search
        </Button>
      </div>
    </div>
  );
};

export default ProxyInput;

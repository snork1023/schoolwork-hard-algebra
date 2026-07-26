import { useState } from "react";
import { useNavigate } from "react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BorderGlow from "@/components/BorderGlow";

const ProxyInput = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      toast({
        title: "Enter a search term",
        description: "Type something to search for",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    navigate("/search", { state: { query: trimmedQuery } });
    setQuery("");
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <BorderGlow
        edgeSensitivity={34}
        glowColor="190 85% 70%"
        backgroundColor="hsl(var(--card) / 0.94)"
        borderRadius={28}
        glowRadius={34}
        glowIntensity={1.1}
        coneSpread={24}
        animated={false}
        colors={["#b41cd6", "#b581f8", "#f472b6"]}
        fillOpacity={0.45}
        className="px-3 py-3"
      >
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="Search DuckDuckGo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            className="flex-1 h-14 text-lg border-0 bg-transparent shadow-none outline-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-0"
            style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.05em" }}
          />
          <Button
            onClick={handleSearch}
            disabled={isLoading}
            className="
      -translate-x-1
      h-12
      px-6
      rounded-full
      bg-primary
      text-primary-foreground
      shadow-md
      transition-all
      duration-300
      ease-out
      hover:bg-primary/90
      hover:scale-105
      active:scale-95
    "
            size="lg"
          >
            <Search className="w-5 h-5 mr-2" />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "1.0rem", letterSpacing: "0.05em" }}>
              Search
            </span>
          </Button>
        </div>
      </BorderGlow>
    </div>
  );
};

export default ProxyInput;
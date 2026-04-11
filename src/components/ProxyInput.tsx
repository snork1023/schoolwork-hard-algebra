import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ProxyInput = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSearch = () => {
    if (!query.trim()) {
      toast({
        title: "Enter a search term",
        description: "Type something to search for",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setQuery("");
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex gap-3">
        <Input
          type="text"
          placeholder="Search DuckDuckGo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          className="flex-1 h-14 text-lg bg-card border-border focus:border-primary transition-all"
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading}
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
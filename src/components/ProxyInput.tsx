import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ProxyInput = () => {
  const [url, setUrl] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const openProxiedSite = () => {
    if (!url.trim()) {
      toast({
        title: "Please enter a URL",
        description: "Enter a website URL to continue",
        variant: "destructive",
      });
      return;
    }

    let finalUrl = url.trim();
    
    // Add https:// if no protocol is specified
    if (!finalUrl.match(/^https?:\/\//i)) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      // Validate URL
      new URL(finalUrl);
      
      // Navigate to browser view with URL as parameter
      navigate(`/browser?url=${encodeURIComponent(finalUrl)}`);
      
      toast({
        title: "Opening site",
        description: "Loading website in browser...",
      });
      
      setUrl("");
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website URL",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      openProxiedSite();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div className="flex gap-3">
        <Input
          type="text"
          placeholder="Enter website URL (e.g., example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 h-14 text-lg bg-card border-border focus:border-primary transition-all"
        />
        <Button
          onClick={openProxiedSite}
          className="h-14 px-8 bg-gradient-to-r from-primary to-accent hover-glow"
          size="lg"
        >
          <ExternalLink className="w-5 h-5 mr-2" />
          Go
        </Button>
      </div>
      
      <Alert className="bg-card border-border">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Compatibility Note</AlertTitle>
        <AlertDescription>
          Some major websites (Google, Facebook, YouTube, banking sites) block iframe embedding 
          and won't work with this proxy. Try smaller websites or news sites for best results.
        </AlertDescription>
      </Alert>
      
      <p className="text-sm text-muted-foreground text-center">
        Opens websites in a new tab with URL masking for privacy
      </p>
    </div>
  );
};

export default ProxyInput;

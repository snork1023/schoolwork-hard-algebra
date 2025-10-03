import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ProxyInput = () => {
  const [url, setUrl] = useState("");
  const { toast } = useToast();

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
      
      // Create the proxied window
      const proxyWindow = window.open("about:blank", "_blank");
      
      if (proxyWindow) {
        // Create iframe content
        const iframeContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Proxied Site</title>
              <style>
                * { margin: 0; padding: 0; }
                body, html { width: 100%; height: 100%; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${finalUrl}" allowfullscreen></iframe>
            </body>
          </html>
        `;
        
        proxyWindow.document.write(iframeContent);
        proxyWindow.document.close();
        
        toast({
          title: "Site opened",
          description: "The website has been opened in a new tab with URL masking",
        });
        
        setUrl("");
      } else {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site to use the proxy",
          variant: "destructive",
        });
      }
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
    <div className="w-full max-w-3xl mx-auto">
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
      <p className="text-sm text-muted-foreground mt-3 text-center">
        Opens websites in a new tab with URL masking for privacy
      </p>
    </div>
  );
};

export default ProxyInput;

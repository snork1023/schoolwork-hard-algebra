import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
        // Create iframe content with error handling
        const iframeContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Proxied Site</title>
              <style>
                * { margin: 0; padding: 0; }
                body, html { 
                  width: 100%; 
                  height: 100%; 
                  overflow: hidden;
                  background: #1a1a2e;
                  color: white;
                  font-family: system-ui, -apple-system, sans-serif;
                }
                iframe { 
                  width: 100%; 
                  height: 100%; 
                  border: none; 
                }
                .error-container {
                  display: none;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  padding: 2rem;
                  text-align: center;
                }
                .error-container.show {
                  display: flex;
                }
                .error-icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
                .error-title {
                  font-size: 1.5rem;
                  margin-bottom: 0.5rem;
                  color: #ef4444;
                }
                .error-message {
                  color: #9ca3af;
                  max-width: 600px;
                  margin-bottom: 1rem;
                }
                .direct-link {
                  display: inline-block;
                  margin-top: 1rem;
                  padding: 0.75rem 1.5rem;
                  background: linear-gradient(135deg, #a855f7, #3b82f6);
                  color: white;
                  text-decoration: none;
                  border-radius: 0.5rem;
                  transition: transform 0.2s;
                }
                .direct-link:hover {
                  transform: scale(1.05);
                }
              </style>
            </head>
            <body>
              <iframe id="proxied-frame" src="${finalUrl}"></iframe>
              <div class="error-container" id="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">This site cannot be proxied</div>
                <div class="error-message">
                  This website blocks iframe embedding for security reasons. 
                  Major sites like Google, Facebook, YouTube, and banking sites use this protection.
                  <br><br>
                  <strong>Try visiting the site directly instead:</strong>
                </div>
                <a href="${finalUrl}" class="direct-link" target="_blank">
                  Open ${new URL(finalUrl).hostname} directly
                </a>
              </div>
              <script>
                const iframe = document.getElementById('proxied-frame');
                const errorContainer = document.getElementById('error-container');
                
                // Check if iframe loads successfully
                let loaded = false;
                
                iframe.onload = function() {
                  loaded = true;
                };
                
                // If iframe doesn't load within 3 seconds, show error
                setTimeout(function() {
                  if (!loaded) {
                    iframe.style.display = 'none';
                    errorContainer.classList.add('show');
                  }
                }, 3000);
                
                // Detect iframe errors
                iframe.onerror = function() {
                  iframe.style.display = 'none';
                  errorContainer.classList.add('show');
                };
              </script>
            </body>
          </html>
        `;
        
        proxyWindow.document.write(iframeContent);
        proxyWindow.document.close();
        
        toast({
          title: "Site opened",
          description: "The website has been opened with URL masking. If it doesn't load, the site blocks iframe embedding.",
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

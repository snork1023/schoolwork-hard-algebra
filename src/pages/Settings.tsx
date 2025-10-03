import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const Settings = () => {
  const [autoOpen, setAutoOpen] = useState(true);
  const [searchEngine, setSearchEngine] = useState("google");

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Settings</h1>
          <p className="text-muted-foreground mb-8">
            Customize your proxy experience
          </p>

          <div className="space-y-6">
            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure basic proxy behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-open">Auto-open in new tab</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically open links in new tabs
                    </p>
                  </div>
                  <Switch
                    id="auto-open"
                    checked={autoOpen}
                    onCheckedChange={setAutoOpen}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Default Search Engine</Label>
                  <Select value={searchEngine} onValueChange={setSearchEngine}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="bing">Bing</SelectItem>
                      <SelectItem value="duckduckgo">DuckDuckGo</SelectItem>
                      <SelectItem value="brave">Brave Search</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Search engine used for quick searches
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Privacy & Security</CardTitle>
                <CardDescription>
                  Manage your privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>URL Masking</Label>
                    <p className="text-sm text-muted-foreground">
                      Always enabled for maximum privacy
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Secure Connection</Label>
                    <p className="text-sm text-muted-foreground">
                      Force HTTPS when possible
                    </p>
                  </div>
                  <Switch checked disabled />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>
                  ProxyGate information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Version:</span> 1.0.0
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-foreground">Purpose:</span> Privacy-focused web proxy
                  </p>
                  <p className="text-muted-foreground">
                    ProxyGate masks your browsing activity by opening websites with a blank URL.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;

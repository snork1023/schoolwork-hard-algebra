import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const accentColors = [
  { name: "Purple", value: "263 70% 50%", class: "bg-[hsl(263,70%,50%)]" },
  { name: "Blue", value: "217 91% 60%", class: "bg-[hsl(217,91%,60%)]" },
  { name: "Green", value: "142 76% 36%", class: "bg-[hsl(142,76%,36%)]" },
  { name: "Red", value: "0 84% 60%", class: "bg-[hsl(0,84%,60%)]" },
  { name: "Orange", value: "25 95% 53%", class: "bg-[hsl(25,95%,53%)]" },
  { name: "Pink", value: "330 81% 60%", class: "bg-[hsl(330,81%,60%)]" },
];

const Settings = () => {
  const [autoOpen, setAutoOpen] = useState(true);
  const [searchEngine, setSearchEngine] = useState("google");
  const [browserType, setBrowserType] = useState(
    localStorage.getItem("browserType") || "chrome"
  );
  const { theme, setTheme } = useTheme();
  const [accentColor, setAccentColor] = useState(
    localStorage.getItem("accentColor") || "263 70% 50%"
  );

  const handleBrowserTypeChange = (value: string) => {
    setBrowserType(value);
    localStorage.setItem("browserType", value);
  };

  const handleAccentColorChange = (value: string) => {
    setAccentColor(value);
    localStorage.setItem("accentColor", value);
    document.documentElement.style.setProperty("--primary", value);
    // Update related colors
    const lightness = parseInt(value.split(" ")[2]);
    document.documentElement.style.setProperty("--primary-glow", value.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`));
    document.documentElement.style.setProperty("--ring", value);
  };

  useEffect(() => {
    // Apply saved accent color on mount
    const savedAccent = localStorage.getItem("accentColor");
    if (savedAccent) {
      handleAccentColorChange(savedAccent);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Settings</h1>
          <p className="text-muted-foreground mb-8">
            Customize your experience
          </p>

          <div className="space-y-6">
            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the app looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Theme</Label>
                    <p className="text-sm text-muted-foreground">
                      Toggle between light and dark theme
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="gap-2"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="ml-4">{theme === "dark" ? "Dark" : "Light"}</span>
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Accent Color</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred accent color
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {accentColors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => handleAccentColorChange(color.value)}
                        className={`w-8 h-8 rounded-full ${color.class} transition-all hover:scale-110 ${
                          accentColor === color.value && !accentColor.startsWith("custom") ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : ""
                        }`}
                        title={color.name}
                      />
                    ))}
                    <label className="relative cursor-pointer">
                      <input
                        type="color"
                        onChange={(e) => {
                          const hex = e.target.value;
                          // Convert hex to HSL
                          const r = parseInt(hex.slice(1, 3), 16) / 255;
                          const g = parseInt(hex.slice(3, 5), 16) / 255;
                          const b = parseInt(hex.slice(5, 7), 16) / 255;
                          const max = Math.max(r, g, b), min = Math.min(r, g, b);
                          let h = 0, s = 0, l = (max + min) / 2;
                          if (max !== min) {
                            const d = max - min;
                            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                            switch (max) {
                              case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                              case g: h = ((b - r) / d + 2) / 6; break;
                              case b: h = ((r - g) / d + 4) / 6; break;
                            }
                          }
                          const hsl = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
                          handleAccentColorChange(hsl);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500 transition-all hover:scale-110 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">+</span>
                      </div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                    <Label htmlFor="browser-type">Browser Type</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which browser interface to display
                    </p>
                  </div>
                  <Select value={browserType} onValueChange={handleBrowserTypeChange}>
                    <SelectTrigger className="w-[180px] bg-background">
                      <SelectValue placeholder="Select browser" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Edge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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

          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;

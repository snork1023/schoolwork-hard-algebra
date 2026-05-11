import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Code, ExternalLink, Keyboard } from "lucide-react";
import ColorPicker from "@/components/ColorPicker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getTabCloakMetadata, TabCloakOption } from "@/components/SettingsProvider";

const accentColors = [
  { name: "Purple", value: "263 70% 50%", class: "bg-[hsl(263,70%,50%)]" },
  { name: "Blue", value: "217 91% 60%", class: "bg-[hsl(217,91%,60%)]" },
  { name: "Green", value: "142 76% 36%", class: "bg-[hsl(142,76%,36%)]" },
  { name: "Red", value: "0 84% 60%", class: "bg-[hsl(0,84%,60%)]" },
  { name: "Orange", value: "25 95% 53%", class: "bg-[hsl(25,95%,53%)]" },
  { name: "Pink", value: "330 81% 60%", class: "bg-[hsl(330,81%,60%)]" },
];

const DEVELOPER_PASSCODE = "snork";

const Settings = () => {
  const { settings, updateSettings, isLoading } = useUserSettings();
  const { theme, setTheme } = useTheme();
  const [passcodeDialogOpen, setPasscodeDialogOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [isListeningForKey, setIsListeningForKey] = useState(false);

  // Listen for panic key binding
  useEffect(() => {
    if (!isListeningForKey) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      updateSettings({ panicKey: e.key });
      setIsListeningForKey(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isListeningForKey, updateSettings]);

  const isCustomColor = settings.customAccentColor && settings.accentColor === settings.customAccentColor;

  const handleAccentColorChange = (value: string) => {
    updateSettings({ accentColor: value });
  };

  const handleCustomColorChange = (hsl: string) => {
    updateSettings({ accentColor: hsl, customAccentColor: hsl });
  };

  const handleCustomFaviconUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateSettings({ customFavicon: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const updateTabCloakMeta = () => {
    const cloak = getTabCloakMetadata(settings);
    document.title = cloak.title;
    const existingIcon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (existingIcon) {
      existingIcon.href = cloak.favicon;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = cloak.favicon;
      document.head.appendChild(link);
    }
  };

  useEffect(() => {
    updateTabCloakMeta();
  }, [settings.tabCloak, settings.customTabTitle, settings.customFavicon]);

  const handleDeveloperModeToggle = (checked: boolean) => {
    if (checked) {
      setPasscodeDialogOpen(true);
      setPasscodeInput("");
      setPasscodeError(false);
    } else {
      updateSettings({ developerMode: false });
    }
  };

  const handlePasscodeSubmit = () => {
    if (passcodeInput === DEVELOPER_PASSCODE) {
      updateSettings({ developerMode: true });
      setPasscodeDialogOpen(false);
      setPasscodeInput("");
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
    }
  };

  // Apply accent color on mount
  useEffect(() => {
    if (!isLoading && settings.accentColor) {
      document.documentElement.style.setProperty('--primary', settings.accentColor);
      const lightness = parseInt(settings.accentColor.split(' ')[2]);
      document.documentElement.style.setProperty('--primary-glow', settings.accentColor.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`));
      document.documentElement.style.setProperty('--ring', settings.accentColor);
    }
  }, [isLoading, settings.accentColor]);

  const devModeEnabled = localStorage.getItem('developerMode') === 'true';

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="max-w-2xl mx-auto">
            {devModeEnabled ? (
              <div className="font-mono text-xs text-muted-foreground space-y-1 bg-card border border-border rounded-lg p-4">
                <p className="text-primary font-bold mb-2">[DEV] Settings Loading...</p>
                <p>→ Reading localStorage for cached settings...</p>
                <p>→ Checking auth state via getUser()...</p>
                <p>→ Fetching profile.settings from database...</p>
                <p>→ Merging local + remote settings...</p>
                <p className="animate-pulse mt-2">⏳ Waiting for response...</p>
              </div>
            ) : (
              <div className="animate-pulse">
                <div className="h-10 bg-muted rounded w-48 mb-8" />
                <div className="space-y-6">
                  <div className="h-48 bg-muted rounded" />
                  <div className="h-48 bg-muted rounded" />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
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
                  <Button variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="gap-2 min-w-[100px]">
                    <div className="relative w-4 h-4">
                      <Sun className="h-4 w-4 absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="h-4 w-4 absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </div>
                    <span>{theme === "dark" ? "Dark" : "Light"}</span>
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
                    {accentColors.map(color => (
                      <button
                        key={color.name}
                        onClick={() => handleAccentColorChange(color.value)}
                        className={`w-8 h-8 rounded-full ${color.class} transition-all hover:scale-110 ${settings.accentColor === color.value && !isCustomColor ? "ring-2 ring-offset-2 ring-offset-background ring-foreground" : ""}`}
                        title={color.name}
                      />
                    ))}
                    <ColorPicker
                      value={settings.customAccentColor}
                      onChange={handleCustomColorChange}
                      isSelected={isCustomColor || false}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Simple Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide nav button labels, show icons only
                    </p>
                  </div>
                  <Switch
                    checked={settings.simpleMode}
                    onCheckedChange={(checked) => updateSettings({ simpleMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Shooting Stars</Label>
                    <p className="text-sm text-muted-foreground">
                      Animated star background effect
                    </p>
                  </div>
                  <Switch
                    checked={settings.showStars}
                    onCheckedChange={(checked) => updateSettings({ showStars: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Proxy Behavior</CardTitle>
                <CardDescription>
                  Configure basic proxy behavior & apperance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="space-y-3">
                    <Label>Tab Cloak</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose the tab title and favicon used when cloaking the site.
                    </p>
                    <Select
                      value={settings.tabCloak}
                      onValueChange={(value) => updateSettings({ tabCloak: value as TabCloakOption })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select a tab cloak" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google-drive">
                          <div className="flex items-center gap-2">
                            <img className="h-4 w-4 rounded-sm" src="https://drive.google.com/favicon.ico" alt="Google Drive" />
                            <span>Google Drive</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="google">
                          <div className="flex items-center gap-2">
                            <img className="h-4 w-4 rounded-sm" src="https://www.google.com/favicon.ico" alt="Google" />
                            <span>Google</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="google-docs">
                          <div className="flex items-center gap-2">
                            <img className="h-4 w-4 rounded-sm" src="https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_document_x16.png" alt="Google Docs" />
                            <span>Google Docs</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="outlook">
                          <div className="flex items-center gap-2">
                            <img className="h-4 w-4 rounded-sm" src="https://upload.wikimedia.org/wikipedia/commons/c/cc/Microsoft_Outlook_Icon_%282025%E2%80%93present%29.svg" alt="Outlook" />
                            <span>Outlook</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="custom">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[10px]">C</span>
                            <span>Custom</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Separator className="my-3" />
                    {settings.tabCloak === 'custom' && (
                      <div className="space-y-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="custom-tab-title">Custom Tab Title</Label>
                          <Input
                            id="custom-tab-title"
                            value={settings.customTabTitle}
                            onChange={(e) => updateSettings({ customTabTitle: e.target.value })}
                            placeholder="Enter title"
                            className="bg-background"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <Label htmlFor="custom-favicon">Custom Favicon</Label>
                          <Input
                            id="custom-favicon"
                            type="file"
                            accept="image/*"
                            onChange={handleCustomFaviconUpload}
                            className="bg-background"
                          />
                          {settings.customFavicon && (
                            <div className="flex items-center gap-2">
                              <img src={settings.customFavicon} alt="Custom favicon preview" className="h-6 w-6 rounded-sm" />
                              <span className="text-sm text-muted-foreground">Preview</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>About:Blank Cloaking</Label>
                      <p className="text-sm text-muted-foreground">
                        Opens the site in an about:blank tab to hide the URL
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const win = window.open('about:blank', '_blank');
                        if (win) {
                          const iframe = win.document.createElement('iframe');
                          iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;margin:0;padding:0;';
                          iframe.src = window.location.href;
                          win.document.body.style.margin = '0';
                          win.document.body.style.overflow = 'hidden';
                          win.document.body.appendChild(iframe);
                          const cloak = getTabCloakMetadata(settings);
                          win.document.title = cloak.title;
                          const link = win.document.createElement('link');
                          link.rel = 'icon';
                          link.href = cloak.favicon;
                          win.document.head.appendChild(link);
                          window.location.href = 'https://google.com';
                        }
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Launch
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Cloak on Startup</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically open in about:blank tab when you visit the site
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoAboutBlank}
                      onCheckedChange={(checked) => updateSettings({ autoAboutBlank: checked })}
                    />
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Panic Key</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Press a key to instantly navigate away to a safe webpage
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant={isListeningForKey ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsListeningForKey(!isListeningForKey)}
                      className="min-w-[140px]"
                    >
                      {isListeningForKey
                        ? "Press any key..."
                        : settings.panicKey
                          ? `Key: ${settings.panicKey.length === 1 ? settings.panicKey.toUpperCase() : settings.panicKey}`
                          : "Set Key"}
                    </Button>
                    {settings.panicKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateSettings({ panicKey: null })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center mt-2">
                    <Label className="text-sm whitespace-nowrap">Redirect URL</Label>
                    <Input
                      value={settings.panicUrl}
                      onChange={(e) => updateSettings({ panicUrl: e.target.value })}
                      placeholder="https://google.com"
                      className="bg-background"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Developer Options
                </CardTitle>
                <CardDescription>
                  Advanced debugging and diagnostic tools
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Developer Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Show debug info
                    </p>
                  </div>
                  <Switch checked={settings.developerMode} onCheckedChange={handleDeveloperModeToggle} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={passcodeDialogOpen} onOpenChange={setPasscodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Developer Passcode</DialogTitle>
            <DialogDescription>
              Developer options require a passcode to enable.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter passcode"
              value={passcodeInput}
              onChange={(e) => {
                setPasscodeInput(e.target.value);
                setPasscodeError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePasscodeSubmit();
              }}
              className={passcodeError ? "border-destructive" : ""}
            />
            {passcodeError && (
              <p className="text-sm text-destructive mt-2">
                Incorrect passcode. Please try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasscodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasscodeSubmit}>
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;

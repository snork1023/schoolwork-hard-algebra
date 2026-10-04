import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dropdown } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import Switch from '@/components/ui/switch';
import Radio from "@/components/ui/radio";
import { useState, useEffect, ChangeEvent } from "react";
import { Link } from "react-router";
import { useTheme } from "next-themes";
import { ExternalLink, Moon, Sun } from "lucide-react";
import ColorPicker from "@/components/ColorPicker";
import BackgroundEffectSettings from "@/components/BackgroundEffectSettings";
import { ScrollRevealCard } from "@/components/ScrollRevealCard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getTabCloakMetadata, TabCloakOption } from "@/components/SettingsProvider";
import { cn } from "@/lib/utils";
import GoogleDriveFavicon from '@/assets/google-drive-favicon.svg';
import GoogleFavicon from '@/assets/google-favicon.ico';
import GoogleDocsFavicon from '@/assets/google-docs-favicon.svg';
import GoogleSlidesFavicon from '@/assets/google-slides-favicon.svg';
import OutlookFavicon from '@/assets/outlook-favicon.svg';
import CleverFavicon from '@/assets/clever-favicon.png';

const accentColors = [
  { name: "Purple", value: "263 70% 50%", class: "bg-[hsl(263,70%,50%)]" },
  { name: "Blue", value: "217 91% 60%", class: "bg-[hsl(217,91%,60%)]" },
  { name: "Teal", value: "174 72% 40%", class: "bg-[hsl(174,72%,40%)]" },
  { name: "Amber", value: "38 92% 50%", class: "bg-[hsl(38,92%,50%)]" },
  { name: "Pink", value: "330 81% 60%", class: "bg-[hsl(330,81%,60%)]" },
];

const DEVELOPER_PASSCODE = "snork";
const appVersion = __APP_VERSION__;

const SettingsRow = ({
  label,
  description,
  children,
  align = "center",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) => (
  <div
    className={cn(
      "flex gap-4 py-4",
      align === "start" ? "items-start" : "items-center",
      "flex-col sm:flex-row sm:justify-between"
    )}
  >
    <div className="min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5">
          {description}
        </p>
      )}
    </div>
    <div className="w-full sm:w-auto shrink-0">{children}</div>
  </div>
);

const compareVersions = (current: string, latest: string) => {
  const currentParts = current.split(".").map((part) => Number(part) || 0);
  const latestParts = latest.split(".").map((part) => Number(part) || 0);
  const maxLength = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const currentValue = currentParts[i] ?? 0;
    const latestValue = latestParts[i] ?? 0;

    if (currentValue > latestValue) return 1;
    if (currentValue < latestValue) return -1;
  }

  return 0;
};

const Settings = () => {
  const { settings, updateSettings, isLoading } = useUserSettings();
  const { theme, setTheme } = useTheme();

  const [passcodeDialogOpen, setPasscodeDialogOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [isListeningForKey, setIsListeningForKey] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  const isBehind =
    latestVersion !== null &&
    compareVersions(appVersion, latestVersion) < 0;

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

  useEffect(() => {
    fetch('/version.json')
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setLatestVersion(data.latestVersion))
      .catch(() => setLatestVersion(null));
  }, []);

  const isCustomColor =
    settings.customAccentColor &&
    settings.accentColor === settings.customAccentColor;

  const handleAccentColorChange = (value: string) => {
    updateSettings({ accentColor: value });
  };

  const handleCustomColorChange = (hsl: string) => {
    updateSettings({
      accentColor: hsl,
      customAccentColor: hsl,
    });
  };

  const handleThemeChange = (next: "light" | "dark") => {
    if (next === theme) return;
    setTheme(next);
  };

  const handleCustomFaviconUpload = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
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

  useEffect(() => {
    const cloak = getTabCloakMetadata(settings);

    document.title = cloak.title;

    const existingIcon = document.querySelector(
      "link[rel~='icon']"
    ) as HTMLLinkElement | null;

    if (existingIcon) {
      existingIcon.href = cloak.favicon;
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = cloak.favicon;
      document.head.appendChild(link);
    }
  }, [settings]);

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

  useEffect(() => {
    if (!isLoading && settings.accentColor) {
      document.documentElement.style.setProperty(
        '--primary',
        settings.accentColor
      );

      const lightness = parseInt(
        settings.accentColor.split(' ')[2]
      );

      document.documentElement.style.setProperty(
        '--primary-glow',
        settings.accentColor.replace(
          /\d+%$/,
          `${Math.min(lightness + 15, 100)}%`
        )
      );

      document.documentElement.style.setProperty(
        '--ring',
        settings.accentColor
      );
    }
  }, [isLoading, settings.accentColor]);

  const handleLaunchAboutBlank = () => {
    const win = window.open('about:blank', '_blank');

    if (!win) return;

    const iframe = win.document.createElement('iframe');

    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;border:none;margin:0;padding:0;';

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
  };

  const themeOptions = [
    {
      value: "light" as const,
      label: "Light",
      Icon: Sun,
    },
    {
      value: "dark" as const,
      label: "Dark",
      Icon: Moon,
    },
  ];

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">
            Settings
          </h1>

          <p className="text-muted-foreground mb-8">
            Customize your experience
          </p>

          <div className="space-y-6">

            {/* Appearance */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize how the app looks
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-9 w-44" />
                      </div>

                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-8 w-48" />
                      </div>

                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">

                      <SettingsRow
                        label="Theme"
                        description="Light or dark interface"
                      >
                        <Radio
                          items={themeOptions.map(
                            ({ value, label, Icon }) => ({
                              value,
                              label,
                              color: "hsl(var(--muted))",
                              content: (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground">
                                  <Icon className="h-4 w-4" />
                                  {label}
                                </span>
                              ),
                            }),
                          )}
                          value={theme ?? "light"}
                          onChange={(value) => {
                            if (value === "light" || value === "dark") {
                              handleThemeChange(value);
                            }
                          }}
                          size="md"
                          shape="pill"
                          gap={8}
                          ariaLabel="Theme"
                        />
                      </SettingsRow>

                      <SettingsRow
                        label="Accent color"
                        description="Choose your prefered color"
                        align="start"
                      >
                        <Radio
                          items={[
                            ...accentColors.map((color) => ({
                              value: color.value,
                              label: "",
                              color: `hsl(${color.value})`,
                            })),
                            {
                              value: "custom",
                              label: "",
                              color: settings.customAccentColor
                                ? `hsl(${settings.customAccentColor})`
                                : "hsl(var(--muted))",
                              content: (
                                <ColorPicker
                                  value={settings.customAccentColor}
                                  onChange={handleCustomColorChange}
                                  isSelected={
                                    isCustomColor || false
                                  }
                                />
                              ),
                            },
                          ]}
                          value={
                            isCustomColor
                              ? "custom"
                              : settings.accentColor
                          }
                          onChange={(value) => {
                            if (value === "custom") return;

                            handleAccentColorChange(value);
                          }}
                          size="md"
                          gap={8}
                          swell={0.12}
                          barge={2}
                          shrink={0.02}
                          jelly={1}
                          bounce={0.15}
                          stagger={10}
                          stiffness={700}
                          ariaLabel="Accent colors"
                          className="color-preset-radio"
                        />
                      </SettingsRow>

                      <SettingsRow
                        label="Animated background"
                        description="Show animated background"
                      >
                        <div className="flex justify-end sm:block">
                          <Switch
                            checked={settings.showBackground}
                            onChange={(checked) =>
                              updateSettings({
                                showBackground: checked,
                              })
                            }
                          />
                        </div>
                      </SettingsRow>

                      {settings.showBackground && (
                        <div className="pt-4">
                          <BackgroundEffectSettings />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Tab Cloak */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Tab Cloak</CardTitle>
                  <CardDescription>
                    Choose the tab title and favicon used when
                    cloaking the site
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <div className="divide-y divide-border">

                      <SettingsRow
                        label="Disguise as"
                        description="What the browser tab will look like"
                      >
                        <Dropdown
                          ariaLabel="Tab cloak"
                          className="w-full sm:w-[200px]"
                          options={[
                            {
                              value: "google-drive",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={GoogleDriveFavicon} alt="" />
                                  <span>Google Drive</span>
                                </div>
                              ),
                            },
                            {
                              value: "google",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={GoogleFavicon} alt="" />
                                  <span>Google</span>
                                </div>
                              ),
                            },
                            {
                              value: "google-docs",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={GoogleDocsFavicon} alt="" />
                                  <span>Google Docs</span>
                                </div>
                              ),
                            },
                            {
                              value: "google-slides",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={GoogleSlidesFavicon} alt="" />
                                  <span>Google Slides</span>
                                </div>
                              ),
                            },
                            {
                              value: "outlook",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={OutlookFavicon} alt="" />
                                  <span>Outlook</span>
                                </div>
                              ),
                            },
                            {
                              value: "clever",
                              label: (
                                <div className="flex items-center gap-2">
                                  <img className="h-4 w-4 rounded-sm" src={CleverFavicon} alt="" />
                                  <span>Clever</span>
                                </div>
                              ),
                            },
                            {
                              value: "custom",
                              label: (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[10px]">
                                    C
                                  </span>
                                  <span>Custom</span>
                                </div>
                              ),
                            },
                          ]}
                          value={settings.tabCloak}
                          onChange={(value) =>
                            updateSettings({
                              tabCloak:
                                value as TabCloakOption,
                            })
                          }
                        />
                      </SettingsRow>

                      {settings.tabCloak === 'custom' && (
                        <>
                          <div className="py-4 space-y-1.5">
                            <Label
                              htmlFor="custom-tab-title"
                              className="text-sm font-medium"
                            >
                              Tab title
                            </Label>

                            <Input
                              id="custom-tab-title"
                              value={settings.customTabTitle}
                              onChange={(e) =>
                                updateSettings({
                                  customTabTitle: e.target.value,
                                })
                              }
                              placeholder="Enter title"
                              className="bg-background"
                            />
                          </div>

                          <div className="py-4 space-y-1.5">
                            <Label
                              htmlFor="custom-favicon"
                              className="text-sm font-medium"
                            >
                              Favicon
                            </Label>

                            <Input
                              id="custom-favicon"
                              type="file"
                              accept="image/*"
                              onChange={
                                handleCustomFaviconUpload
                              }
                              className="bg-background"
                            />

                            {settings.customFavicon && (
                              <div className="flex items-center gap-2 pt-1">
                                <img
                                  src={settings.customFavicon}
                                  alt=""
                                  className="h-6 w-6 rounded-sm"
                                />

                                <span className="text-xs text-muted-foreground">
                                  Current favicon
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* About:Blank Cloaking */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>About:Blank Cloaking</CardTitle>
                  <CardDescription>
                    Open the site in an about:blank tab so the URL
                    is hidden
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-8 w-20" />
                      </div>

                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-12" />
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">

                      <SettingsRow
                        label="Launch now"
                        description="Opens this page in a hidden window and sends this tab to Google"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 w-full sm:w-auto"
                          onClick={handleLaunchAboutBlank}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Launch
                        </Button>
                      </SettingsRow>

                      <SettingsRow
                        label="Auto-cloak on startup"
                        description="Do this automatically every time you visit the site"
                        align="start"
                      >
                        <div className="flex justify-end sm:block">
                          <Switch
                            checked={settings.autoAboutBlank}
                            onChange={(checked) =>
                              updateSettings({
                                autoAboutBlank: checked,
                              })
                            }
                          />
                        </div>
                      </SettingsRow>

                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Panic Key */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Panic Key</CardTitle>
                  <CardDescription>
                    Press a key to instantly leave for a safe page
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-9 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="divide-y divide-border">

                      <SettingsRow
                        label="Trigger key"
                        description="The key that fires the escape"
                      >
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            variant={
                              isListeningForKey
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() =>
                              setIsListeningForKey(
                                !isListeningForKey
                              )
                            }
                            className="flex-1 sm:flex-none sm:min-w-[140px]"
                          >
                            {isListeningForKey
                              ? "Press any key..."
                              : settings.panicKey
                                ? `Key: ${
                                    settings.panicKey.length === 1
                                      ? settings.panicKey.toUpperCase()
                                      : settings.panicKey
                                  }`
                                : "Set key"}
                          </Button>

                          {settings.panicKey && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateSettings({
                                  panicKey: null,
                                })
                              }
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </SettingsRow>

                      <div className="py-4 space-y-1.5">
                        <Label
                          htmlFor="panic-url"
                          className="text-sm font-medium"
                        >
                          Redirect to
                        </Label>

                        <Input
                          id="panic-url"
                          value={settings.panicUrl}
                          onChange={(e) =>
                            updateSettings({
                              panicUrl: e.target.value,
                            })
                          }
                          placeholder="https://google.com"
                          className="bg-background"
                        />
                      </div>

                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* Developer Options */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>Developer Options</CardTitle>
                  <CardDescription>
                    Advanced debugging and diagnostic tools
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  ) : (
                    <SettingsRow
                      label="Developer mode"
                      description="Show debug info. Requires a passcode to turn on"
                      align="start"
                    >
                      <div className="flex justify-end sm:block">
                        <Switch
                          checked={settings.developerMode}
                          onChange={handleDeveloperModeToggle}
                        />
                      </div>
                    </SettingsRow>
                  )}
                </CardContent>
              </Card>
            </ScrollRevealCard>

            {/* App Info */}
            <ScrollRevealCard>
              <Card className="border-black/10 bg-card/85 shadow-lg backdrop-blur-sm hover-glow dark:border-white/15">
                <CardHeader>
                  <CardTitle>App Info</CardTitle>
                  <CardDescription>
                    Repository, legal, and version details
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="divide-y divide-border">

                    <SettingsRow
                      label="Repository"
                      description="Source code on GitHub"
                    >
                      <a
                        href="https://github.com/snork1023/schoolwork-hard-algebra"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                      >
                        GitHub
                      </a>
                    </SettingsRow>

                    <SettingsRow label="Legal">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link
                          to="/termsofservice"
                          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                        >
                          Terms of Service
                        </Link>

                        <Link
                          to="/privacypolicy"
                          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
                        >
                          Privacy Policy
                        </Link>
                      </div>
                    </SettingsRow>

                    <SettingsRow
                      label="Version"
                      description={
                        latestVersion
                          ? isBehind
                            ? `Update available: ${latestVersion}`
                            : "Up to date"
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-sm",
                          isBehind
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border bg-muted/60 text-muted-foreground"
                        )}
                      >
                        {appVersion}
                      </span>
                    </SettingsRow>

                  </div>
                </CardContent>
              </Card>
            </ScrollRevealCard>

          </div>
        </div>
      </main>

      <Dialog
        open={passcodeDialogOpen}
        onOpenChange={setPasscodeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Enter Developer Passcode
            </DialogTitle>

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
                if (e.key === "Enter") {
                  handlePasscodeSubmit();
                }
              }}
              className={
                passcodeError
                  ? "border-destructive"
                  : ""
              }
            />

            {passcodeError && (
              <p className="text-sm text-destructive mt-2">
                Incorrect passcode. Please try again.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setPasscodeDialogOpen(false)
              }
            >
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
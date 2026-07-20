import { useEffect, createContext, useContext, ReactNode, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import GoogleDriveFavicon from '@/assets/google-drive-favicon.svg';
import GoogleFavicon from '@/assets/google-favicon.ico';
import GoogleDocsFavicon from '@/assets/google-docs-favicon.svg';
import GoogleSlidesFavicon from '@/assets/google-slides-favicon.svg';
import OutlookFavicon from '@/assets/outlook-favicon.svg';
import CleverFavicon from '@/assets/clever-favicon.png';

export type TabCloakOption = 'google-drive' | 'google' | 'google-docs' | 'google-slides' | 'outlook' | 'clever' | 'custom';

export interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
  showBackground: boolean;
  panicKey: string | null;
  panicUrl: string;
  autoAboutBlank: boolean;
  tabCloak: TabCloakOption;
  customTabTitle: string;
  customFavicon: string | null;
  veilSpeed: number;
  veilHueShift: number | null;
  veilWarpAmount: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  accentColor: '263 70% 50%',
  customAccentColor: null,
  browserType: 'chrome',
  searchEngine: 'duckduckgo',
  autoOpen: true,
  developerMode: false,
  showBackground: true,
  panicKey: null,
  panicUrl: 'https://google.com',
  autoAboutBlank: false,
  tabCloak: 'google-drive',
  customTabTitle: 'Google Drive',
  customFavicon: null,
  veilSpeed: 0.5,
  veilHueShift: null,
  veilWarpAmount: 0.15,
};

const parseNumber = (value: string | null, fallback: number): number => {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadFromLocalStorage = (): UserSettings => ({
  accentColor: localStorage.getItem('accentColor') || DEFAULT_SETTINGS.accentColor,
  customAccentColor: localStorage.getItem('customAccentColor') || null,
  browserType: localStorage.getItem('browserType') || DEFAULT_SETTINGS.browserType,
  searchEngine: localStorage.getItem('searchEngine') || DEFAULT_SETTINGS.searchEngine,
  autoOpen: localStorage.getItem('autoOpen') !== 'false',
  developerMode: localStorage.getItem('developerMode') === 'true',
  showBackground: localStorage.getItem('showBackground') !== 'false',
  panicKey: localStorage.getItem('panicKey') || null,
  panicUrl: localStorage.getItem('panicUrl') || DEFAULT_SETTINGS.panicUrl,
  autoAboutBlank: localStorage.getItem('autoAboutBlank') === 'true',
  tabCloak: (localStorage.getItem('tabCloak') as TabCloakOption) || DEFAULT_SETTINGS.tabCloak,
  customTabTitle: localStorage.getItem('customTabTitle') || DEFAULT_SETTINGS.customTabTitle,
  customFavicon: localStorage.getItem('customFavicon') || null,
  veilSpeed: parseNumber(localStorage.getItem('veilSpeed'), DEFAULT_SETTINGS.veilSpeed),
  veilHueShift: localStorage.getItem('veilHueShift') === null
    ? null
    : parseNumber(localStorage.getItem('veilHueShift'), 0),
  veilWarpAmount: parseNumber(localStorage.getItem('veilWarpAmount'), DEFAULT_SETTINGS.veilWarpAmount),
});

const syncToLocalStorage = (s: UserSettings) => {
  localStorage.setItem('accentColor', s.accentColor);
  if (s.customAccentColor) {
    localStorage.setItem('customAccentColor', s.customAccentColor);
  } else {
    localStorage.removeItem('customAccentColor');
  }
  localStorage.setItem('browserType', s.browserType);
  localStorage.setItem('searchEngine', s.searchEngine);
  localStorage.setItem('autoOpen', String(s.autoOpen));
  localStorage.setItem('developerMode', s.developerMode ? 'true' : 'false');
  localStorage.setItem('showBackground', s.showBackground ? 'true' : 'false');
  if (s.panicKey) {
    localStorage.setItem('panicKey', s.panicKey);
  } else {
    localStorage.removeItem('panicKey');
  }
  localStorage.setItem('panicUrl', s.panicUrl);
  localStorage.setItem('autoAboutBlank', s.autoAboutBlank ? 'true' : 'false');
  localStorage.setItem('tabCloak', s.tabCloak);
  localStorage.setItem('customTabTitle', s.customTabTitle);
  if (s.customFavicon) {
    localStorage.setItem('customFavicon', s.customFavicon);
  } else {
    localStorage.removeItem('customFavicon');
  }
  localStorage.setItem('veilSpeed', String(s.veilSpeed));
  if (s.veilHueShift !== null) {
    localStorage.setItem('veilHueShift', String(s.veilHueShift));
  } else {
    localStorage.removeItem('veilHueShift');
  }
  localStorage.setItem('veilWarpAmount', String(s.veilWarpAmount));
};

export const getTabCloakMetadata = (settings: UserSettings) => {
  switch (settings.tabCloak) {
    case 'google-drive':
      return {
        title: 'My Drive - Google Drive',
        favicon: GoogleDriveFavicon,
      };
    case 'google':
      return {
        title: 'Google',
        favicon: GoogleFavicon,
      };
    case 'google-docs':
      return {
        title: 'Google Docs',
        favicon: GoogleDocsFavicon,
      };
    case 'google-slides':
      return {
        title: 'Google Slides',
        favicon: GoogleSlidesFavicon,
      };
    case 'outlook':
      return {
        title: 'Outlook',
        favicon: OutlookFavicon,
      };
    case 'clever':
      return {
        title: 'Clever | Portal',
        favicon: CleverFavicon,
      };
    case 'custom':
      return {
        title: settings.customTabTitle || 'New Tab',
        favicon: settings.customFavicon || 'GoogleFavicon',
      };
    default:
      return {
        title: 'My Drive - Google Drive',
        favicon: GoogleDriveFavicon,
      };
  }
};

const applyAccentColor = (color: string) => {
  document.documentElement.style.setProperty('--primary', color);
  const lightness = parseInt(color.split(' ')[2] || '50');
  document.documentElement.style.setProperty(
    '--primary-glow',
    color.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`)
  );
  document.documentElement.style.setProperty('--ring', color);
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  isLoading: false,
  isAuthenticated: false,
});

export const useSettingsContext = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings>(loadFromLocalStorage);
  const [userId, setUserId] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global panic key listener – directly navigates to the panic URL
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = settingsRef.current.panicKey;
      if (!key) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        const rawPanicUrl = settingsRef.current.panicUrl.trim();
        const absolutePanicUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(rawPanicUrl)
          ? rawPanicUrl
          : `https://${rawPanicUrl.replace(/^\/+/, '')}`;

        try {
          if (window.top && window.top !== window) {
            window.open(absolutePanicUrl, '_top');
            return;
          }
        } catch {
            window.open(absolutePanicUrl, '_self');
        }

        window.location.replace(absolutePanicUrl);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto about:blank cloaking on startup
  useEffect(() => {
    // Only run on the top-level window (not inside an iframe) and if enabled
    if (window.self !== window.top) return;
    if (!settingsRef.current.autoAboutBlank) return;
    // Mark so we don't loop
    const alreadyCloaked = sessionStorage.getItem('aboutBlankCloaked');
    if (alreadyCloaked) return;
    sessionStorage.setItem('aboutBlankCloaked', 'true');

    const currentUrl = window.location.href;
    const win = window.open('about:blank', '_blank');
    if (win) {
      const iframe = win.document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;margin:0;padding:0;';
      iframe.src = currentUrl;
      win.document.body.style.margin = '0';
      win.document.body.style.overflow = 'hidden';
      win.document.body.appendChild(iframe);
      const cloak = getTabCloakMetadata(settingsRef.current);
      win.document.title = cloak.title;
      const link = win.document.createElement('link');
      link.rel = 'icon';
      link.href = cloak.favicon;
      win.document.head.appendChild(link);
      // Redirect the original tab to Google
      window.location.replace('https://google.com');
    }
  }, []);

  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, []);

  // Listen for auth and merge DB settings
  useEffect(() => {
    let active = true;

    const mergeDbSettings = async (uid: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', uid)
          .maybeSingle();

        if (!active) return;
        if (profile?.settings && typeof profile.settings === 'object') {
          const dbSettings = profile.settings as Partial<UserSettings>;
          const merged = { ...settingsRef.current, ...dbSettings };
          setSettings(merged);
          syncToLocalStorage(merged);
          if (dbSettings.accentColor) applyAccentColor(dbSettings.accentColor);
        }
      } catch (err) {
        console.warn('Failed to fetch user settings from DB', err);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        setUserId(session.user.id);
        mergeDbSettings(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const accentColorChanged =
      updates.accentColor !== undefined && updates.accentColor !== settingsRef.current.accentColor;
    const finalUpdates =
      accentColorChanged && updates.veilHueShift === undefined
        ? { ...updates, veilHueShift: null }
        : updates;

    const newSettings = { ...settingsRef.current, ...finalUpdates };
    setSettings(newSettings);

    if (updates.accentColor) {
      applyAccentColor(updates.accentColor);
    }

    // Debounce the actual persistence (localStorage + Supabase) so rapid-fire
    // updates like slider dragging don't spam writes. UI state above updates
    // instantly for a live preview regardless.
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
    }

    persistTimeoutRef.current = setTimeout(async () => {
      syncToLocalStorage(newSettings);

      const currentUserId = userId;
      if (currentUserId) {
        await supabase
          .from('profiles')
          .update({ settings: newSettings })
          .eq('id', currentUserId);
      }
    }, 400);
  }, [userId]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading: false, isAuthenticated: !!userId }}>
      {children}
    </SettingsContext.Provider>
  );
};
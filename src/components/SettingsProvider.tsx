import { useEffect, createContext, useContext, ReactNode, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
  simpleMode: boolean;
  showStars: boolean;
  panicKey: string | null;
  panicUrl: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  accentColor: '263 70% 50%',
  customAccentColor: null,
  browserType: 'chrome',
  searchEngine: 'google',
  autoOpen: true,
  developerMode: false,
  simpleMode: false,
  showStars: true,
  panicKey: null,
  panicUrl: 'https://google.com',
};

const loadFromLocalStorage = (): UserSettings => ({
  accentColor: localStorage.getItem('accentColor') || DEFAULT_SETTINGS.accentColor,
  customAccentColor: localStorage.getItem('customAccentColor') || null,
  browserType: localStorage.getItem('browserType') || DEFAULT_SETTINGS.browserType,
  searchEngine: localStorage.getItem('searchEngine') || DEFAULT_SETTINGS.searchEngine,
  autoOpen: localStorage.getItem('autoOpen') !== 'false',
  developerMode: localStorage.getItem('developerMode') === 'true',
  simpleMode: localStorage.getItem('simpleMode') === 'true',
  showStars: localStorage.getItem('showStars') !== 'false',
  panicKey: localStorage.getItem('panicKey') || null,
  panicUrl: localStorage.getItem('panicUrl') || DEFAULT_SETTINGS.panicUrl,
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
  localStorage.setItem('simpleMode', s.simpleMode ? 'true' : 'false');
  localStorage.setItem('showStars', s.showStars ? 'true' : 'false');
  if (s.panicKey) {
    localStorage.setItem('panicKey', s.panicKey);
  } else {
    localStorage.removeItem('panicKey');
  }
  localStorage.setItem('panicUrl', s.panicUrl);
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

  // Apply accent color on mount
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
    const newSettings = { ...settingsRef.current, ...updates };
    setSettings(newSettings);
    syncToLocalStorage(newSettings);

    if (updates.accentColor) {
      applyAccentColor(updates.accentColor);
    }

    const currentUserId = userId;
    if (currentUserId) {
      await supabase
        .from('profiles')
        .update({ settings: newSettings })
        .eq('id', currentUserId);
    }
  }, [userId]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading: false, isAuthenticated: !!userId }}>
      {children}
    </SettingsContext.Provider>
  );
};

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
}

const DEFAULT_ACCENT = '263 70% 50%';

const SettingsContext = createContext<{ isLoaded: boolean }>({ isLoaded: false });

export const useSettingsLoaded = () => useContext(SettingsContext);

const applyAccentColor = (color: string) => {
  document.documentElement.style.setProperty('--primary', color);
  const lightness = parseInt(color.split(' ')[2] || '50');
  document.documentElement.style.setProperty(
    '--primary-glow',
    color.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`)
  );
  document.documentElement.style.setProperty('--ring', color);
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // First apply localStorage settings immediately for fast load
      const localAccent = localStorage.getItem('accentColor');
      if (localAccent) {
        applyAccentColor(localAccent);
      }

      // Then check if user is logged in and has DB settings
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.settings && typeof profile.settings === 'object') {
          const dbSettings = profile.settings as Partial<UserSettings>;
          if (dbSettings.accentColor) {
            applyAccentColor(dbSettings.accentColor);
            localStorage.setItem('accentColor', dbSettings.accentColor);
          }
          if (dbSettings.customAccentColor) {
            localStorage.setItem('customAccentColor', dbSettings.customAccentColor);
          }
          if (dbSettings.browserType) {
            localStorage.setItem('browserType', dbSettings.browserType);
          }
          if (dbSettings.searchEngine) {
            localStorage.setItem('searchEngine', dbSettings.searchEngine);
          }
          if (dbSettings.autoOpen !== undefined) {
            localStorage.setItem('autoOpen', String(dbSettings.autoOpen));
          }
          if (dbSettings.developerMode) {
            localStorage.setItem('developerMode', 'true');
          }
        }
      }

      setIsLoaded(true);
    };

    loadSettings();

    // Listen for auth changes to reload settings
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.settings && typeof profile.settings === 'object') {
          const dbSettings = profile.settings as Partial<UserSettings>;
          if (dbSettings.accentColor) {
            applyAccentColor(dbSettings.accentColor);
            localStorage.setItem('accentColor', dbSettings.accentColor);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ isLoaded }}>
      {children}
    </SettingsContext.Provider>
  );
};

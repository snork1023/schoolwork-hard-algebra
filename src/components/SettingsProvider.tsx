import { useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
}

const SettingsContext = createContext<{ isLoaded: boolean }>({ isLoaded: true });

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
  // Apply localStorage accent color synchronously on mount — never blocks render
  useEffect(() => {
    const localAccent = localStorage.getItem('accentColor');
    if (localAccent) {
      applyAccentColor(localAccent);
    }

    // Listen for auth changes to merge DB settings
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        try {
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
        } catch (err) {
          console.warn('Failed to load DB settings', err);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SettingsContext.Provider value={{ isLoaded: true }}>
      {children}
    </SettingsContext.Provider>
  );
};

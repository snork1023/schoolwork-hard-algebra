import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  accentColor: '263 70% 50%',
  customAccentColor: null,
  browserType: 'chrome',
  searchEngine: 'google',
  autoOpen: true,
  developerMode: false,
};

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from localStorage first, then override with DB if logged in
  useEffect(() => {
    const loadSettings = async () => {
      // Load from localStorage as defaults
      const localSettings: UserSettings = {
        accentColor: localStorage.getItem('accentColor') || DEFAULT_SETTINGS.accentColor,
        customAccentColor: localStorage.getItem('customAccentColor') || null,
        browserType: localStorage.getItem('browserType') || DEFAULT_SETTINGS.browserType,
        searchEngine: localStorage.getItem('searchEngine') || DEFAULT_SETTINGS.searchEngine,
        autoOpen: localStorage.getItem('autoOpen') !== 'false',
        developerMode: localStorage.getItem('developerMode') === 'true',
      };
      setSettings(localSettings);

      // Check if user is logged in
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;
        if (user) {
          setUserId(user.id);
          // Fetch settings from database
          const { data: profile } = await supabase
            .from('profiles')
            .select('settings')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.settings && typeof profile.settings === 'object') {
            const dbSettings = profile.settings as Partial<UserSettings>;
            const mergedSettings = { ...localSettings, ...dbSettings };
            setSettings(mergedSettings);
            // Sync to localStorage
            syncToLocalStorage(mergedSettings);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch user settings from DB, using local settings', err);
      }
      setIsLoading(false);
    };

    loadSettings();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('settings')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.settings && typeof profile.settings === 'object') {
          const dbSettings = profile.settings as Partial<UserSettings>;
          setSettings(prev => {
            const merged = { ...prev, ...dbSettings };
            syncToLocalStorage(merged);
            return merged;
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    if (s.developerMode) {
      localStorage.setItem('developerMode', 'true');
    } else {
      localStorage.removeItem('developerMode');
    }
  };

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    syncToLocalStorage(newSettings);

    // Apply accent color immediately
    if (updates.accentColor) {
      document.documentElement.style.setProperty('--primary', updates.accentColor);
      const lightness = parseInt(updates.accentColor.split(' ')[2]);
      document.documentElement.style.setProperty('--primary-glow', updates.accentColor.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`));
      document.documentElement.style.setProperty('--ring', updates.accentColor);
    }

    // Save to database if logged in
    if (userId) {
      await supabase
        .from('profiles')
        .update({ settings: newSettings })
        .eq('id', userId);
    }
  }, [settings, userId]);

  return { settings, updateSettings, isLoading, isAuthenticated: !!userId };
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserSettings {
  accentColor: string;
  customAccentColor: string | null;
  browserType: string;
  searchEngine: string;
  autoOpen: boolean;
  developerMode: boolean;
  simpleMode: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  accentColor: '263 70% 50%',
  customAccentColor: null,
  browserType: 'chrome',
  searchEngine: 'google',
  autoOpen: true,
  developerMode: false,
  simpleMode: false,
};

const loadFromLocalStorage = (): UserSettings => ({
  accentColor: localStorage.getItem('accentColor') || DEFAULT_SETTINGS.accentColor,
  customAccentColor: localStorage.getItem('customAccentColor') || null,
  browserType: localStorage.getItem('browserType') || DEFAULT_SETTINGS.browserType,
  searchEngine: localStorage.getItem('searchEngine') || DEFAULT_SETTINGS.searchEngine,
  autoOpen: localStorage.getItem('autoOpen') !== 'false',
  developerMode: localStorage.getItem('developerMode') === 'true',
  simpleMode: localStorage.getItem('simpleMode') === 'true',
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
  if (s.developerMode) {
    localStorage.setItem('developerMode', 'true');
  } else {
    localStorage.removeItem('developerMode');
  }
  if (s.simpleMode) {
    localStorage.setItem('simpleMode', 'true');
  } else {
    localStorage.removeItem('simpleMode');
  }
};

export const useUserSettings = () => {
  // Load from localStorage synchronously — never block render
  const [settings, setSettings] = useState<UserSettings>(loadFromLocalStorage);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading] = useState(false); // never loading — localStorage is instant
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Async: merge DB settings when auth is available
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

    // Apply accent color immediately
    if (updates.accentColor) {
      document.documentElement.style.setProperty('--primary', updates.accentColor);
      const lightness = parseInt(updates.accentColor.split(' ')[2]);
      document.documentElement.style.setProperty('--primary-glow', updates.accentColor.replace(/\d+%$/, `${Math.min(lightness + 15, 100)}%`));
      document.documentElement.style.setProperty('--ring', updates.accentColor);
    }

    // Save to database if logged in
    const currentUserId = userId;
    if (currentUserId) {
      await supabase
        .from('profiles')
        .update({ settings: newSettings })
        .eq('id', currentUserId);
    }
  }, [userId]);

  return { settings, updateSettings, isLoading, isAuthenticated: !!userId };
};

import { useEffect, createContext, useContext, ReactNode, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/integrations/firebase/client';
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
  simpleMode: boolean;
  showStars: boolean;
  panicKey: string | null;
  panicUrl: string;
  autoAboutBlank: boolean;
  tabCloak: TabCloakOption;
  customTabTitle: string;
  customFavicon: string | null;
}

const DEFAULT_SETTINGS: UserSettings = {
  accentColor: '263 70% 50%',
  customAccentColor: null,
  browserType: 'chrome',
  searchEngine: 'duckduckgo',
  autoOpen: true,
  developerMode: false,
  simpleMode: false,
  showStars: true,
  panicKey: null,
  panicUrl: 'https://google.com',
  autoAboutBlank: false,
  tabCloak: 'google-drive',
  customTabTitle: 'Google Drive',
  customFavicon: null,
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
  autoAboutBlank: localStorage.getItem('autoAboutBlank') === 'true',
  tabCloak: (localStorage.getItem('tabCloak') as TabCloakOption) || DEFAULT_SETTINGS.tabCloak,
  customTabTitle: localStorage.getItem('customTabTitle') || DEFAULT_SETTINGS.customTabTitle,
  customFavicon: localStorage.getItem('customFavicon') || null,
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
  localStorage.setItem('autoAboutBlank', s.autoAboutBlank ? 'true' : 'false');
  localStorage.setItem('tabCloak', s.tabCloak);
  localStorage.setItem('customTabTitle', s.customTabTitle);
  if (s.customFavicon) {
    localStorage.setItem('customFavicon', s.customFavicon);
  } else {
    localStorage.removeItem('customFavicon');
  }
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
        } catch {}

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
    if (!isFirebaseConfigured || !auth || !db) return;
    let active = true;

    const mergeDbSettings = async (uid: string) => {
      try {
        const snap = await getDoc(doc(db!, 'userSettings', uid));
        if (!active) return;
        const data = snap.data();
        if (data?.settings && typeof data.settings === 'object') {
          const dbSettings = data.settings as Partial<UserSettings>;
          const merged = { ...settingsRef.current, ...dbSettings };
          setSettings(merged);
          syncToLocalStorage(merged);
          if (dbSettings.accentColor) applyAccentColor(dbSettings.accentColor);
        }
      } catch (err) {
        console.warn('Failed to fetch user settings from Firestore', err);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!active) return;
      if (user) {
        setUserId(user.uid);
        mergeDbSettings(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
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
    if (currentUserId && db) {
      try {
        await setDoc(
          doc(db, 'userSettings', currentUserId),
          { settings: newSettings, updatedAt: Date.now() },
          { merge: true }
        );
      } catch (err) {
        console.warn('Failed to persist settings to Firestore', err);
      }
    }
  }, [userId]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading: false, isAuthenticated: !!userId }}>
      {children}
    </SettingsContext.Provider>
  );
};

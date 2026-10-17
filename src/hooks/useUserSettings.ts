import { useSettingsContext } from '@/providers/SettingsProvider';

export type { UserSettings } from '@/providers/SettingsProvider';

export const useUserSettings = () => useSettingsContext();

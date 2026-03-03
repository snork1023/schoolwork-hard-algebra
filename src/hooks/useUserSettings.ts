import { useSettingsContext } from '@/components/SettingsProvider';

export type { UserSettings } from '@/components/SettingsProvider';

export const useUserSettings = () => useSettingsContext();

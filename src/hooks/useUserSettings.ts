import { useSettingsContext } from '@/components/providers/SettingsProvider';

export type { UserSettings } from '@/components/providers/SettingsProvider';

export const useUserSettings = () => useSettingsContext();

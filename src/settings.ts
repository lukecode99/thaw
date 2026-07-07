// User preferences, persisted through the same encrypted storage as
// everything else. One key, one JSON object, safe defaults on any failure.
import type { KeyValueStorage } from './entryStore';

const SETTINGS_KEY = 'thaw.settings.v1';

export interface Settings {
  /** Partner signals (in-app and device banners). On by default. */
  notifications: boolean;
}

export const DEFAULT_SETTINGS: Settings = { notifications: true };

export interface SettingsStore {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}

export function createSettingsStore(storage: KeyValueStorage): SettingsStore {
  return {
    async load() {
      try {
        const raw = await storage.getItem(SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    },
    async save(settings) {
      await storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },
  };
}

import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { invoke } from '@tauri-apps/api/core';

export interface PluginSDK {
  clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
  };
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

export function createPluginSDK(pluginId: string): PluginSDK {
  return {
    clipboard: {
      readText: async () => {
        const result = await readText();
        return result ?? '';
      },
      writeText,
    },
    storage: {
      async get(key: string) {
        try {
          return await invoke<string>('plugin_storage_get', { pluginId, key });
        } catch {
          return null;
        }
      },
      async set(key: string, value: string) {
        try {
          await invoke('plugin_storage_set', { pluginId, key, value });
        } catch (e) {
          console.error('Plugin storage set failed:', e);
        }
      },
    },
    invoke: (cmd, args) => invoke(cmd, args),
  };
}

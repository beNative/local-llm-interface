import type { Config } from './types';

export interface IElectronAPI {
  getSettings: () => Promise<Config | null>;
  saveSettings: (settings: Config) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

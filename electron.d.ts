import type { Config, LogEntry } from './types';

export interface IElectronAPI {
  getSettings: () => Promise<Config | null>;
  saveSettings: (settings: Config) => Promise<void>;
  isPackaged: () => Promise<boolean>;
  runPython: (code: string) => Promise<{ stdout: string; stderr: string }>;
  writeLog: (entry: LogEntry) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

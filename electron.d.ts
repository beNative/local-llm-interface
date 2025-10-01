import type { Config, LogEntry, CodeProject, ProjectType, FileSystemEntry, ApiRequest, ApiResponse, ToolchainStatus, GlobalShortcutRegistrationInput, GlobalShortcutRegistrationResult, ShortcutActionId } from './types';

export interface SystemStats {
  cpu: number;
  memory: {
    used: number;
    total: number;
  };
  gpu?: number;
}

export interface IElectronAPI {
  getSettings: () => Promise<Config | null>;
  saveSettings: (settings: Config) => Promise<void>;
  registerGlobalShortcuts: (shortcuts: GlobalShortcutRegistrationInput[]) => Promise<GlobalShortcutRegistrationResult[]>;
  isPackaged: () => Promise<boolean>;
  getVersion: () => Promise<string>;
  runPython: (code: string) => Promise<{ stdout: string; stderr: string }>;
  runNodejs: (code: string) => Promise<{ stdout: string; stderr: string }>;
  runHtml: (code: string) => Promise<{ stdout: string; stderr: string }>;
  writeLog: (entry: LogEntry) => Promise<void>;
  makeApiRequest: (request: ApiRequest) => Promise<ApiResponse>;
  detectToolchains: () => Promise<ToolchainStatus>;
  checkProviderHealth: (baseUrl: string) => Promise<boolean>;
  exportSettings: (settings: Config) => Promise<{ success: boolean; error?: string }>;
  importSettings: () => Promise<{ success: boolean; content?: string; error?: string }>;

  // App Updates
  checkForUpdates: () => Promise<void>;
  quitAndInstallUpdate: () => Promise<void>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  removeUpdateAvailableListener: () => void;
  onUpdateDownloading: (callback: () => void) => void;
  removeUpdateDownloadingListener: () => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  removeUpdateDownloadedListener: () => void;
  onUpdateError: (callback: (error: Error) => void) => void;
  removeUpdateErrorListener: () => void;
  onUpdateNotAvailable: (callback: (info: any) => void) => void;
  removeUpdateNotAvailableListener: () => void;

  // Project Management APIs
  selectDirectory: () => Promise<string | null>;
  createProject: (args: { projectType: ProjectType; name: string; basePath: string }) => Promise<CodeProject>;
  deleteProject: (projectPath: string) => Promise<void>;
  openProjectFolder: (folderPath: string) => Promise<void>;
  openWebApp: (projectPath: string) => Promise<void>;
  installProjectDeps: (project: CodeProject) => Promise<{ stdout: string; stderr: string }>;
  runScriptInProject: (args: { project: CodeProject; code: string }) => Promise<{ stdout: string; stderr: string }>;
  runProject: (project: CodeProject) => Promise<{ stdout: string; stderr: string }>;
  projectRunCommand: (args: { projectPath: string, command: string }) => Promise<{ stdout: string; stderr: string }>;

  // File System APIs for Project Viewer/Editor
  readProjectDir: (dirPath: string) => Promise<FileSystemEntry[]>;
  readProjectFile: (filePath: string) => Promise<string>;
  writeProjectFile: (filePath: string, content: string) => Promise<void>;
  projectGetFileTree: (projectPath: string) => Promise<string>;
  projectGetAllFiles: (projectPath: string) => Promise<{name: string, path: string}[]>;
  projectListFilesRecursive: (projectPath: string) => Promise<string[]>;
  projectAddFileFromPath: (args: {sourcePath: string, targetDir: string}) => Promise<void>;
  projectFindFile: (args: { projectPath: string, fileName: string }) => Promise<string | null>;

  // System Stats
  onSystemStatsUpdate: (callback: (stats: SystemStats) => void) => void;
  removeSystemStatsUpdateListener: () => void;
  
  // Window Controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  unmaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;
  removeWindowStateChangeListener: () => void;
  onShortcutTriggered: (callback: (actionId: ShortcutActionId) => void) => void;
  removeShortcutTriggeredListener: () => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

import type { Config, LogEntry, CodeProject, ProjectType, FileSystemEntry, ApiRequest, ApiResponse, ToolchainStatus } from './types';

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
  isPackaged: () => Promise<boolean>;
  runPython: (code: string) => Promise<{ stdout: string; stderr: string }>;
  runNodejs: (code: string) => Promise<{ stdout: string; stderr: string }>;
  runHtml: (code: string) => Promise<{ stdout: string; stderr: string }>;
  writeLog: (entry: LogEntry) => Promise<void>;
  makeApiRequest: (request: ApiRequest) => Promise<ApiResponse>;
  detectToolchains: () => Promise<ToolchainStatus>;

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
  removeAllSystemStatsUpdateListeners: () => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
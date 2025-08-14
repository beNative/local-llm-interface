
import type { Config, LogEntry, CodeProject, ProjectType } from './types';

export interface IElectronAPI {
  getSettings: () => Promise<Config | null>;
  saveSettings: (settings: Config) => Promise<void>;
  isPackaged: () => Promise<boolean>;
  runPython: (code: string) => Promise<{ stdout: string; stderr: string }>;
  runNodejs: (code: string) => Promise<{ stdout: string; stderr: string }>;
  writeLog: (entry: LogEntry) => Promise<void>;

  // Project Management APIs
  selectDirectory: () => Promise<string | null>;
  createProject: (args: { projectType: ProjectType; name: string; basePath: string }) => Promise<CodeProject>;
  deleteProject: (projectPath: string) => Promise<void>;
  openProjectFolder: (folderPath: string) => Promise<void>;
  installProjectDeps: (project: CodeProject) => Promise<{ stdout: string; stderr: string }>;
  runScriptInProject: (args: { project: CodeProject; code: string }) => Promise<{ stdout: string; stderr: string }>;
  addFileToProject: (args: {
    projectPath: string;
    filename: string;
    content: string;
    overwrite: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}

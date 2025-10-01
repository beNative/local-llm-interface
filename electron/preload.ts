

// FIX: Changed from destructured import to namespace import to resolve module access errors.
import * as electron from 'electron';
import type { CodeProject, GlobalShortcutRegistrationInput, ShortcutActionId } from '../src/types';

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object.
 */
electron.contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invokes the 'settings:get' channel in the main process to fetch stored settings.
   * @returns {Promise<object | null>} A promise that resolves with the stored config or null.
   */
  getSettings: () => electron.ipcRenderer.invoke('settings:get'),

  /**
   * Invokes the 'settings:save' channel in the main process to persist settings.
   * @param {object} settings - The configuration object to save.
   * @returns {Promise<void>} A promise that resolves when the settings are saved.
   */
  saveSettings: (settings: object) => electron.ipcRenderer.invoke('settings:save', settings),

  registerGlobalShortcuts: (shortcuts: GlobalShortcutRegistrationInput[]) => electron.ipcRenderer.invoke('shortcuts:register-global', shortcuts),
  onShortcutTriggered: (callback: (actionId: ShortcutActionId) => void) => electron.ipcRenderer.on('shortcuts:trigger', (_event, actionId) => callback(actionId)),
  removeShortcutTriggeredListener: () => electron.ipcRenderer.removeAllListeners('shortcuts:trigger'),

  /**
   * Checks if the application is running in a packaged state.
   * @returns {Promise<boolean>} A promise that resolves with true if packaged, false otherwise.
   */
  isPackaged: () => electron.ipcRenderer.invoke('app:is-packaged'),

  /**
   * Gets the application's version number from package.json.
   * @returns {Promise<string>} A promise that resolves with the version string.
   */
  getVersion: () => electron.ipcRenderer.invoke('app:get-version'),

  /**
   * Executes a Python code snippet in a native system process.
   * @param {string} code - The Python code to execute.
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the output.
   */
  runPython: (code: string) => electron.ipcRenderer.invoke('python:run', code),

  /**
   * Executes a Node.js code snippet in a native system process.
   * @param {string} code - The Node.js code to execute.
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the output.
   */
  runNodejs: (code: string) => electron.ipcRenderer.invoke('nodejs:run', code),

  /**
   * Executes an HTML code snippet by opening it in the browser.
   * @param {string} code - The HTML code to execute.
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the output.
   */
  runHtml: (code: string) => electron.ipcRenderer.invoke('html:run', code),

  /**
   * Invokes the 'log:write' channel to write a log entry to a file.
   * @param {object} entry - The log entry object.
   * @returns {Promise<void>} A promise that resolves when the log is written.
   */
  writeLog: (entry: object) => electron.ipcRenderer.invoke('log:write', entry),
  
  /**
   * Invokes the 'api:make-request' channel to execute an HTTP request from the main process.
   * @param {ApiRequest} request - The API request object.
   * @returns {Promise<ApiResponse>} A promise that resolves with the API response.
   */
  makeApiRequest: (request: any) => electron.ipcRenderer.invoke('api:make-request', request),
  
  /**
   * Scans the system for installed development tools.
   * @returns {Promise<ToolchainStatus>} A promise that resolves with the detected toolchains.
   */
  detectToolchains: () => electron.ipcRenderer.invoke('detect:toolchains'),
  
  /**
   * Checks if a provider's server is reachable.
   * @param {string} baseUrl - The base URL of the provider.
   * @returns {Promise<boolean>} A promise that resolves with true if online, false otherwise.
   */
  checkProviderHealth: (baseUrl: string) => electron.ipcRenderer.invoke('provider:health-check', baseUrl),

  exportSettings: (settings: object) => electron.ipcRenderer.invoke('settings:export', settings),
  importSettings: () => electron.ipcRenderer.invoke('settings:import'),

  // App Updates
  checkForUpdates: () => electron.ipcRenderer.invoke('updates:check'),
  quitAndInstallUpdate: () => electron.ipcRenderer.invoke('updates:install'),
  onUpdateAvailable: (callback: any) => electron.ipcRenderer.on('update-available', (_event, ...args) => callback(...args)),
  removeUpdateAvailableListener: () => electron.ipcRenderer.removeAllListeners('update-available'),
  onUpdateDownloading: (callback: any) => electron.ipcRenderer.on('update-downloading', (_event) => callback()),
  removeUpdateDownloadingListener: () => electron.ipcRenderer.removeAllListeners('update-downloading'),
  onUpdateDownloaded: (callback: any) => electron.ipcRenderer.on('update-downloaded', (_event, ...args) => callback(...args)),
  removeUpdateDownloadedListener: () => electron.ipcRenderer.removeAllListeners('update-downloaded'),
  onUpdateError: (callback: any) => electron.ipcRenderer.on('update-error', (_event, ...args) => callback(...args)),
  removeUpdateErrorListener: () => electron.ipcRenderer.removeAllListeners('update-error'),
  onUpdateNotAvailable: (callback: any) => electron.ipcRenderer.on('update-not-available', (_event, ...args) => callback(...args)),
  removeUpdateNotAvailableListener: () => electron.ipcRenderer.removeAllListeners('update-not-available'),

  // Project Management APIs
  selectDirectory: () => electron.ipcRenderer.invoke('dialog:select-directory'),
  createProject: (args: any) => electron.ipcRenderer.invoke('project:create', args),
  deleteProject: (projectPath: string) => electron.ipcRenderer.invoke('project:delete', projectPath),
  openProjectFolder: (folderPath: string) => electron.ipcRenderer.invoke('project:open-folder', folderPath),
  openWebApp: (projectPath: string) => electron.ipcRenderer.invoke('project:open-webapp', projectPath),
  installProjectDeps: (project: any) => electron.ipcRenderer.invoke('project:install-deps', project),
  runScriptInProject: (args: any) => electron.ipcRenderer.invoke('project:run-script', args),
  runProject: (project: CodeProject) => electron.ipcRenderer.invoke('project:run', project),
  projectRunCommand: (args: { projectPath: string, command: string }) => electron.ipcRenderer.invoke('project:run-command', args),

  // File System APIs for Project Viewer/Editor
  readProjectDir: (dirPath: string) => electron.ipcRenderer.invoke('project:read-dir', dirPath),
  readProjectFile: (filePath: string) => electron.ipcRenderer.invoke('project:read-file', filePath),
  writeProjectFile: (filePath: string, content: string) => electron.ipcRenderer.invoke('project:write-file', filePath, content),
  projectGetFileTree: (projectPath: string) => electron.ipcRenderer.invoke('project:get-file-tree', projectPath),
  projectGetAllFiles: (projectPath: string) => electron.ipcRenderer.invoke('project:get-all-files', projectPath),
  projectListFilesRecursive: (projectPath: string) => electron.ipcRenderer.invoke('project:list-files-recursive', projectPath),
  projectAddFileFromPath: (args: {sourcePath: string, targetDir: string}) => electron.ipcRenderer.invoke('project:add-file-from-path', args),
  projectFindFile: (args: { projectPath: string, fileName: string }) => electron.ipcRenderer.invoke('project:find-file', args),

  // System Stats
  onSystemStatsUpdate: (callback: any) => electron.ipcRenderer.on('system-stats-update', (_event, value) => callback(value)),
  removeSystemStatsUpdateListener: () => electron.ipcRenderer.removeAllListeners('system-stats-update'),

  // Window Controls
  minimizeWindow: () => electron.ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => electron.ipcRenderer.invoke('window:maximize'),
  unmaximizeWindow: () => electron.ipcRenderer.invoke('window:unmaximize'),
  closeWindow: () => electron.ipcRenderer.invoke('window:close'),
  // FIX: Complete truncated line and function signature to match electron.d.ts
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => electron.ipcRenderer.on('window-state-changed', (_event, isMaximized) => callback(isMaximized)),
  // FIX: Add missing function to match electron.d.ts
  removeWindowStateChangeListener: () => electron.ipcRenderer.removeAllListeners('window-state-changed'),
});
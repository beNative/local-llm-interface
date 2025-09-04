// FIX: Switched to a namespace import for Electron to resolve module resolution errors.
import * as electron from 'electron';
import type { CodeProject } from '../src/types';

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

  /**
   * Checks if the application is running in a packaged state.
   * @returns {Promise<boolean>} A promise that resolves with true if packaged, false otherwise.
   */
  isPackaged: () => electron.ipcRenderer.invoke('app:is-packaged'),

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
  onSystemStatsUpdate: (callback) => electron.ipcRenderer.on('system-stats-update', (_event, value) => callback(value)),
  removeAllSystemStatsUpdateListeners: () => electron.ipcRenderer.removeAllListeners('system-stats-update'),
});

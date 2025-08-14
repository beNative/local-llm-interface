import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose protected methods that allow the renderer process to use
 * the ipcRenderer without exposing the entire object.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invokes the 'settings:get' channel in the main process to fetch stored settings.
   * @returns {Promise<object | null>} A promise that resolves with the stored config or null.
   */
  getSettings: () => ipcRenderer.invoke('settings:get'),

  /**
   * Invokes the 'settings:save' channel in the main process to persist settings.
   * @param {object} settings - The configuration object to save.
   * @returns {Promise<void>} A promise that resolves when the settings are saved.
   */
  saveSettings: (settings: object) => ipcRenderer.invoke('settings:save', settings),

  /**
   * Checks if the application is running in a packaged state.
   * @returns {Promise<boolean>} A promise that resolves with true if packaged, false otherwise.
   */
  isPackaged: () => ipcRenderer.invoke('app:is-packaged'),

  /**
   * Executes a Python code snippet in a native system process.
   * @param {string} code - The Python code to execute.
   * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with the output.
   */
  runPython: (code: string) => ipcRenderer.invoke('python:run', code),
});

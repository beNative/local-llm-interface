
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import * as crypto from 'crypto';


// The path where user settings will be stored.
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * Reads the settings from the JSON file.
 * @returns {object | null}
 */
const readSettings = () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read settings file:', error);
  }
  return null;
};

/**
 * Writes the given settings object to the JSON file.
 * @param {object} settings
 */
const saveSettings = (settings: object) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save settings file:', error);
  }
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Attach the preload script
      preload: path.join(__dirname, 'preload.js'),
      // Security best practices
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Local LLM Interface',
    autoHideMenuBar: true,
  });

  // Load the app's index.html file.
  const indexPath = path.join(__dirname, 'index.html');
  mainWindow.loadFile(indexPath);

  // Open external links in the user's default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });
};

// This method will be called when Electron has finished initialization.
app.whenReady().then(() => {
    // Set up IPC listeners for the renderer process
    ipcMain.handle('settings:get', readSettings);
    ipcMain.handle('settings:save', (_, settings) => saveSettings(settings));

    ipcMain.handle('app:is-packaged', () => {
        return app.isPackaged;
    });

    ipcMain.handle('log:write', (_, entry: { timestamp: string, level: string, message: string }) => {
        try {
            const logDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(logDir, `local-llm-interface-${date}.log`);
            const formatted = `[${entry.timestamp}] [${entry.level}] ${entry.message}\n`;
            fs.appendFileSync(logFile, formatted);
        } catch (error) {
            console.error('Failed to write to log file:', error);
            // We can't easily inform the renderer from here without a potential loop,
            // so we'll just log to the main process console.
            throw error; // Throw error back to renderer
        }
    });

    ipcMain.handle('python:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        const tempDir = os.tmpdir();
        const tempFileName = `pyscript_${crypto.randomBytes(6).toString('hex')}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);

        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            return await new Promise((resolve, reject) => {
                const child = spawn('python', [tempFilePath]);
                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => { stdout += data.toString(); });
                child.stderr.on('data', (data) => { stderr += data.toString(); });

                child.on('error', (error) => {
                    console.error('Failed to start python subprocess.', error);
                    reject(error);
                });

                child.on('close', (exitCode) => {
                    console.log(`Python process exited with code ${exitCode}`);
                    resolve({ stdout, stderr });
                });
            });
        } catch(error) {
            const errorMessage = `Failed to execute script: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            return { stdout: '', stderr: errorMessage };
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });


    createWindow();

    // Re-create a window on macOS when the dock icon is clicked and there are no other windows open.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') {
    app.quit();
  }
});

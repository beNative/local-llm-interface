const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
  const indexPath = path.join(__dirname, '..', 'index.html');
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
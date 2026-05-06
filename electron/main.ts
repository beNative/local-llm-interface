

// FIX: Changed from destructured import to namespace import to resolve module access errors.
import * as electron from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import { readdir, stat, readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import * as os from 'os';
import { spawn, exec } from 'child_process';
import * as crypto from 'crypto';
import { pathToFileURL } from 'url';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import type { IncomingHttpHeaders } from 'http';
import type { ApiRequest, ApiResponse, CodeProject, GlobalShortcutRegistrationInput, GlobalShortcutRegistrationResult, ProjectType, ShortcutActionId, Toolchain, ToolchainStatus } from '../src/types';

// Let TypeScript know that __dirname is a global variable in this Node.js environment.
// This is necessary because we are using ES Modules, which don't have __dirname by default.
// Esbuild, our bundler, will correctly define it at build time for the Node.js platform.
declare const __dirname: string;

// The path to the user's application data directory. This is the standard
// location for storing application configuration files.
const appDataPath = electron.app.getPath('userData');

// The path where user settings will be stored.
const settingsPath = path.join(appDataPath, 'settings.json');

let mainWindowInstance: electron.BrowserWindow | null = null;
/**
 * Configures the autoUpdater with the current user settings.
 * Centralises the pre-release toggle so it's set consistently.
 */
const configureAutoUpdater = () => {
    const settings = readSettings() as any;
    autoUpdater.allowPrerelease = !!(settings?.allowPrerelease);
    console.log(`Auto-updater configured: allowPrerelease=${autoUpdater.allowPrerelease}`);
};
const registeredGlobalShortcuts = new Map<string, ShortcutActionId>();


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
  } catch (error)
  {
    console.error('Failed to save settings file:', error);
  }
};

/** Maximum output size in bytes before truncation (100 KB). */
const MAX_OUTPUT_SIZE = 100 * 1024;

/** Default timeout for spawned processes in milliseconds (60 seconds). */
const DEFAULT_COMMAND_TIMEOUT_MS = 60_000;

/**
 * Truncates a string to `maxLength` characters, appending a notice if truncated.
 */
const truncateOutput = (output: string, maxLength: number = MAX_OUTPUT_SIZE): string => {
    if (output.length <= maxLength) return output;
    return output.slice(0, maxLength) + `\n\n[Output truncated — exceeded ${Math.round(maxLength / 1024)}KB limit]`;
};

const runCommand = (
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd, shell: os.platform() === 'win32' });
        let stdout = '';
        let stderr = '';
        let killed = false;

        // Enforce timeout
        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            // Give it a moment to terminate gracefully, then force-kill
            setTimeout(() => {
                try { child.kill('SIGKILL'); } catch (_) { /* already dead */ }
            }, 2000);
        }, timeoutMs);

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            if (stdout.length < MAX_OUTPUT_SIZE) {
                stdout += chunk;
            }
        });
        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            if (stderr.length < MAX_OUTPUT_SIZE) {
                stderr += chunk;
            }
        });
        
        child.on('error', (error) => {
            clearTimeout(timer);
            console.error(`Spawn error for ${command}`, error);
            stderr += `\nFailed to start command: ${error.message}`;
            resolve({ stdout: truncateOutput(stdout), stderr: truncateOutput(stderr) });
        });

        child.on('close', (code) => {
            clearTimeout(timer);
            if (killed) {
                stderr += `\nProcess was terminated — exceeded ${timeoutMs / 1000}s timeout.`;
            } else if (code !== 0) {
                stderr += `\nProcess exited with non-zero code: ${code}`;
            }
            resolve({ stdout: truncateOutput(stdout), stderr: truncateOutput(stderr) });
        });
    });
};

const runInExternalConsole = (commandWithArgs: string, cwd: string): Promise<{ stdout: string; stderr: string }> => {
    const platform = os.platform();

    if (platform !== 'win32') {
        const msg = `External console only implemented for Windows. Cannot run on ${platform}.`;
        console.log(msg);
        return Promise.resolve({ stdout: '', stderr: msg });
    }

    return new Promise((resolve) => {
        // We use `shell: true` so that the command string is interpreted by cmd.exe,
        // which correctly handles operators like `&&` and internal commands like `start`.
        // A title "..." is provided to `start` to prevent it from misinterpreting a
        // quoted path in the command as the window title.
        const command = `start "Python Runner" cmd.exe /k ${commandWithArgs}`;
        const child = spawn(command, { cwd, shell: true });

        let stderr = '';
        // We can't capture stdout/stderr from the new window, but we can see errors from spawn itself.
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        
        child.on('error', (error) => {
            console.error(`Spawn error for external console:`, error);
            resolve({ stdout: '', stderr: `Failed to start external console: ${error.message}` });
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: `Process started in a new console window.`, stderr: stderr });
            } else {
                const errorMsg = `Command to start external console exited with code ${code}. Stderr: ${stderr}`;
                console.error(errorMsg);
                resolve({ stdout: '', stderr: errorMsg });
            }
        });
    });
};


const getPythonExecutable = (venvPath: string): string => {
    if (os.platform() === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
    }
    return path.join(venvPath, 'bin', 'python');
};

const execCommand = (cmd: string, args: string[] = []): Promise<string> => {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { shell: os.platform() === 'win32' });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', data => stdout += data.toString());
        child.stderr.on('data', data => stderr += data.toString());
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr.trim()));
            }
        });
    });
};

const openPathInBrowser = async (targetPath: string) => {
    const fileUrl = pathToFileURL(targetPath).toString();
    await electron.shell.openExternal(fileUrl);
};

async function detectPythonInterpreters(): Promise<Toolchain[]> {
    const interpreters = new Set<string>();
    const commands = os.platform() === 'win32' ? ['py -0p', 'where python', 'where python3'] : ['which -a python3', 'which -a python'];

    for (const cmd of commands) {
        try {
            const [command, ...args] = cmd.split(' ');
            const output = await execCommand(command, args);
            const lines = output.split('\n').filter(Boolean);

            if (cmd === 'py -0p') {
                lines.forEach(line => {
                    const match = line.match(/\s+(C:.*\.exe)/i);
                    if (match) interpreters.add(match[1].trim());
                });
            } else {
                 lines.forEach(line => interpreters.add(line.trim()));
            }
        } catch (e) { /* command might not exist, ignore */ }
    }

    const toolchains: Toolchain[] = [];
    for (const p of interpreters) {
        try {
            const versionOutput = await execCommand(p, ['--version']);
            const version = versionOutput.split(' ')[1] || versionOutput;
            toolchains.push({ path: p, version, name: `Python ${version}` });
        } catch (e) { console.warn(`Could not get version for python at ${p}`); }
    }
    return toolchains;
}

async function detectJavaCompilers(): Promise<Toolchain[]> {
    const compilers = new Set<string>();
    const cmd = os.platform() === 'win32' ? 'where javac' : 'which javac';

    try {
        const [command, ...args] = cmd.split(' ');
        const output = await execCommand(command, args);
        output.split('\n').filter(Boolean).forEach(p => compilers.add(p.trim()));
    } catch (e) { /* ignore */ }

    const toolchains: Toolchain[] = [];
    for (const p of compilers) {
        try {
            const javaPath = p.replace('javac.exe', 'java.exe').replace('/bin/javac', '/bin/java');
            const versionOutput = await execCommand(javaPath, ['-version']);
            const versionMatch = versionOutput.match(/"(\d+\.\d+\.\d+)_?\d*"/);
            const version = versionMatch ? versionMatch[1] : 'Unknown';
            const jdkPath = path.dirname(path.dirname(p)); // up from /bin
            toolchains.push({ path: jdkPath, version, name: `JDK ${version}` });
        } catch (e) { console.warn(`Could not get version for java at ${p}`); }
    }
    return toolchains;
}

async function detectNodeJS(): Promise<Toolchain[]> {
    const nodes = new Set<string>();
    const cmd = os.platform() === 'win32' ? 'where node' : 'which node';
    try {
        const [command, ...args] = cmd.split(' ');
        const output = await execCommand(command, args);
        output.split('\n').filter(Boolean).forEach(p => nodes.add(p.trim()));
    } catch (e) { /* ignore */ }

    const toolchains: Toolchain[] = [];
    for (const p of nodes) {
        try {
            const versionOutput = await execCommand(p, ['--version']);
            toolchains.push({ path: p, version: versionOutput, name: `Node.js ${versionOutput}` });
        } catch (e) { console.warn(`Could not get version for node at ${p}`); }
    }
    return toolchains;
}

async function detectDelphiCompilers(): Promise<Toolchain[]> {
    if (os.platform() !== 'win32') return [];
    try {
        const output = await execCommand('reg', ['query', 'HKCU\\Software\\Embarcadero\\BDS', '/s', '/v', 'RootDir']);
        const toolchains: Toolchain[] = [];
        const regex = /HKEY_CURRENT_USER\\Software\\Embarcadero\\BDS\\(\d+\.\d+)\s+RootDir\s+REG_SZ\s+(.*)/g;
        let match;
        while ((match = regex.exec(output)) !== null) {
            const version = match[1];
            const path = match[2].trim();
            toolchains.push({ path, version, name: `RAD Studio ${version}` });
        }
        return toolchains;
    } catch (e) {
        return [];
    }
}

const ignoredDirsAndFiles = new Set(['.git', 'node_modules', 'venv', 'target', '.DS_Store', 'dist', 'release', '__pycache__']);

let previousCpuTimes = os.cpus().map(cpu => {
    let total = 0;
    for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times];
    }
    return { total, idle: cpu.times.idle };
});

const getGpuStatsNvidia = (): Promise<{ usage: number, name?: string, isUnified?: boolean, memory: { used: number, total: number } }> => {
    return new Promise((resolve) => {
        // Query more fields: name, usage, used, total, and c2c.mode (for unified memory detection)
        const smi = spawn('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total,c2c.mode', '--format=csv,noheader,nounits']);
        let stdout = '';
        smi.stdout.on('data', (data) => { stdout += data.toString(); });
        smi.on('error', () => { resolve({ usage: -1, memory: { used: 0, total: 0 } }); });
        smi.on('close', (code) => {
            if (code === 0) {
                const parts = stdout.trim().split(',').map(s => s.trim());
                if (parts.length >= 4) {
                    const name = parts[0];
                    const usage = parseFloat(parts[1]);
                    const used = parseFloat(parts[2]);
                    const total = parseFloat(parts[3]);
                    const c2cMode = parts[4]; // Optional field

                    const isUnified = c2cMode === 'Enabled' || 
                                     name.toLowerCase().includes('blackwell') || 
                                     name.toLowerCase().includes('grace') || 
                                     name.toLowerCase().includes('dgx spark');

                    return resolve({ 
                        name,
                        isUnified,
                        usage: isNaN(usage) ? -1 : usage, 
                        memory: { 
                            used: isNaN(used) ? 0 : used * 1024 * 1024, 
                            total: isNaN(total) ? 0 : total * 1024 * 1024
                        } 
                    });
                }
            }
            resolve({ usage: -1, memory: { used: 0, total: 0 } });
        });
    });
};

const getGpuStatsMac = (): Promise<{ usage: number, name?: string, isUnified: boolean, memory: { used: number, total: number } }> => {
    return new Promise((resolve) => {
        const profiler = spawn('system_profiler', ['SPDisplaysDataType']);
        let stdout = '';
        profiler.stdout.on('data', (data) => { stdout += data.toString(); });
        profiler.on('close', () => {
            const vramMatch = stdout.match(/VRAM \(Total\):\s+(\d+)\s+GB/i) || stdout.match(/VRAM \(Dynamic, Max\):\s+(\d+)\s+GB/i);
            const totalGB = vramMatch ? parseInt(vramMatch[1], 10) : 0;
            const nameMatch = stdout.match(/Chipset Model:\s+(.*)/i);
            const name = nameMatch ? nameMatch[1].trim() : 'Apple GPU';

            resolve({
                name,
                usage: -1,
                isUnified: true, // All Apple Silicon is unified
                memory: {
                    used: 0,
                    total: totalGB * 1024 * 1024 * 1024
                }
            });
        });
        profiler.on('error', () => resolve({ usage: -1, isUnified: true, memory: { used: 0, total: 0 } }));
    });
};

const getGpuStatsWinGeneric = (): Promise<{ usage: number, memory: { used: number, total: number } }> => {
    return new Promise((resolve) => {
        const wmic = spawn('wmic', ['path', 'win32_VideoController', 'get', 'AdapterRAM']);
        let stdout = '';
        wmic.stdout.on('data', (data) => { stdout += data.toString(); });
        wmic.on('close', () => {
            const lines = stdout.trim().split('\n');
            const ram = lines.length > 1 ? parseInt(lines[1].trim(), 10) : 0;
            resolve({
                usage: -1,
                memory: {
                    used: 0,
                    total: isNaN(ram) ? 0 : ram
                }
            });
        });
        wmic.on('error', () => resolve({ usage: -1, memory: { used: 0, total: 0 } }));
    });
};

const getGpuStats = async (): Promise<{ usage: number, memory: { used: number, total: number } }> => {
    const platform = os.platform();
    
    if (platform === 'darwin') {
        return getGpuStatsMac();
    }

    if (platform === 'win32' || platform === 'linux') {
        const nvidia = await getGpuStatsNvidia();
        if (nvidia.usage !== -1 || nvidia.memory.total > 0) {
            return nvidia;
        }

        if (platform === 'win32') {
            return getGpuStatsWinGeneric();
        }
    }

    return { usage: -1, memory: { used: 0, total: 0 } };
};

const createWindow = () => {
  // Use __dirname to reliably resolve paths both in development and in the packaged app.
  // Esbuild correctly provides __dirname in a Node.js context.
  const preloadScriptPath = path.join(__dirname, 'preload.js');
  const indexPath = path.join(__dirname, 'index.html');
    
  // Create the browser window.
  const mainWindow: electron.BrowserWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Attach the preload script.
      preload: preloadScriptPath,
      // Security best practices
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Local LLM Interface',
    autoHideMenuBar: true,
    // Add these options for a frameless window
    frame: false,
    titleBarStyle: 'hidden',
  });

  mainWindowInstance = mainWindow;

  // Listen for window state changes and notify the renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', false);
  });


  // System-wide Stats Monitoring
  const statsInterval = setInterval(async () => {
    if (mainWindow.isDestroyed()) {
      clearInterval(statsInterval);
      return;
    }

    const cpus = os.cpus();
    let totalCpuUsage = 0;
    for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i];
        const prevCpu = previousCpuTimes[i];
        let total = 0;
        for (const type in cpu.times) {
            total += cpu.times[type as keyof typeof cpu.times];
        }
        const idle = cpu.times.idle;

        const totalDiff = total - prevCpu.total;
        const idleDiff = idle - prevCpu.idle;
        
        const usage = (totalDiff > 0) ? (1 - idleDiff / totalDiff) * 100 : 0;
        totalCpuUsage += usage;

        previousCpuTimes[i] = { total, idle };
    }

    const avgCpuUsage = totalCpuUsage / cpus.length;
    const totalSystemMem = os.totalmem();
    const usedSystemMem = totalSystemMem - os.freemem();
    const gpuStats = await getGpuStats();

    mainWindow.webContents.send('system-stats-update', {
      cpu: avgCpuUsage,
      memory: {
        used: usedSystemMem,
        total: totalSystemMem,
      },
      gpu: gpuStats.usage,
      vram: { ...gpuStats.memory, isUnified: gpuStats.isUnified },
    });
  }, 2000); // Send stats every 2 seconds

  // Load the app's index.html file.
  mainWindow.loadFile(indexPath);

  // Open external links in the user's default browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      electron.shell.openExternal(url);
      return { action: 'deny' };
  });
};

// This method will be called when Electron has finished initialization.
electron.app.whenReady().then(() => {
    // Set up IPC listeners for the renderer process
    electron.ipcMain.handle('settings:get', readSettings);
    electron.ipcMain.handle('settings:save', (_, settings) => saveSettings(settings));
    electron.ipcMain.handle('shortcuts:register-global', (_event, registrations: GlobalShortcutRegistrationInput[]): GlobalShortcutRegistrationResult[] => {
      registeredGlobalShortcuts.forEach((_, accelerator) => {
        electron.globalShortcut.unregister(accelerator);
      });
      registeredGlobalShortcuts.clear();

      const results: GlobalShortcutRegistrationResult[] = [];
      const usedAccelerators = new Map<string, ShortcutActionId>();

      registrations.forEach(({ actionId, accelerator, enabled }) => {
        if (!enabled || !accelerator) {
          results.push({ actionId, accelerator, success: true });
          return;
        }

        const existing = usedAccelerators.get(accelerator);
        if (existing) {
          results.push({
            actionId,
            accelerator,
            success: false,
            error: `Conflicts with ${existing}`,
          });
          return;
        }

        try {
          const success = electron.globalShortcut.register(accelerator, () => {
            if (!mainWindowInstance) {
              return;
            }
            if (mainWindowInstance.isMinimized()) {
              mainWindowInstance.restore();
            }
            mainWindowInstance.show();
            mainWindowInstance.focus();
            mainWindowInstance.webContents.send('shortcuts:trigger', actionId);
          });

          if (success) {
            usedAccelerators.set(accelerator, actionId);
            registeredGlobalShortcuts.set(accelerator, actionId);
            results.push({ actionId, accelerator, success: true });
          } else {
            results.push({ actionId, accelerator, success: false, error: 'Registration failed' });
          }
        } catch (error) {
          results.push({
            actionId,
            accelerator,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      return results;
    });

    electron.ipcMain.handle('app:is-packaged', () => {
        return electron.app.isPackaged;
    });

    electron.ipcMain.handle('app:get-version', () => electron.app.getVersion());

    electron.ipcMain.handle('detect:toolchains', async (): Promise<ToolchainStatus> => {
        console.log("Detecting toolchains...");
        const [python, java, nodejs, delphi] = await Promise.all([
            detectPythonInterpreters(),
            detectJavaCompilers(),
            detectNodeJS(),
            detectDelphiCompilers(),
        ]);
        console.log(`Detected: ${python.length} Python, ${java.length} Java, ${nodejs.length} Node, ${delphi.length} Delphi`);
        return { python, java, nodejs, delphi };
    });

    electron.ipcMain.handle('log:write', (_, entry: { timestamp: string, level: string, message: string }) => {
        try {
            const logDir = electron.app.getPath('userData');
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

    // Log retention: clean up log files older than 7 days on startup
    try {
        const LOG_RETENTION_DAYS = 7;
        const logDir = electron.app.getPath('userData');
        const cutoff = Date.now() - LOG_RETENTION_DAYS * 86400000;
        const logFilePattern = /^local-llm-interface-\d{4}-\d{2}-\d{2}\.log$/;
        const files = fs.readdirSync(logDir);
        let cleaned = 0;
        for (const file of files) {
            if (!logFilePattern.test(file)) continue;
            const filePath = path.join(logDir, file);
            try {
                const fileStat = fs.statSync(filePath);
                if (fileStat.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            } catch { /* skip unreadable files */ }
        }
        if (cleaned > 0) {
            console.log(`[log-retention] Cleaned up ${cleaned} log file(s) older than ${LOG_RETENTION_DAYS} days.`);
        }
    } catch (error) {
        console.warn('[log-retention] Failed to clean old log files:', error);
    }

    electron.ipcMain.handle('python:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        const settings: any = readSettings();
        const pythonCommand = settings?.selectedPythonPath || 'python';

        const tempDir = os.tmpdir();
        const tempFileName = `pyscript_${crypto.randomBytes(6).toString('hex')}.py`;
        const tempFilePath = path.join(tempDir, tempFileName);

        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            return await new Promise((resolve, reject) => {
                console.log(`Executing python script with command: ${pythonCommand}`);
                const child = spawn(pythonCommand, [tempFilePath], { shell: os.platform() === 'win32' });
                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => { stdout += data.toString(); });
                child.stderr.on('data', (data) => { stderr += data.toString(); });

                child.on('error', (error) => {
                    console.error(`Failed to start python subprocess with command "${pythonCommand}".`, error);
                    // On spawn error (e.g., command not found), reject the promise
                    reject(error);
                });

                child.on('close', (exitCode) => {
                    console.log(`Python process exited with code ${exitCode}`);
                    resolve({ stdout, stderr });
                });
            });
        } catch(error) {
            const errorMessage = `Failed to execute script with command "${pythonCommand}": ${error instanceof Error ? error.message : String(error)}. Please check the Python Command in Settings.`;
            console.error(errorMessage);
            return { stdout: '', stderr: errorMessage };
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });

    electron.ipcMain.handle('nodejs:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        const settings: any = readSettings();
        const nodeCommand = settings?.selectedNodePath || 'node';
        const tempDir = os.tmpdir();
        const tempFileName = `nodescript_${crypto.randomBytes(6).toString('hex')}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);

        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            return await new Promise((resolve, reject) => {
                const child = spawn(nodeCommand, [tempFilePath], { shell: os.platform() === 'win32' });
                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => { stdout += data.toString(); });
                child.stderr.on('data', (data) => { stderr += data.toString(); });

                child.on('error', (error) => {
                    console.error('Failed to start node subprocess.', error);
                    reject(error);
                });

                child.on('close', (exitCode) => {
                    console.log(`Node.js process exited with code ${exitCode}`);
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
    
    electron.ipcMain.handle('html:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        try {
            const snippetDir = path.join(os.homedir(), 'Downloads', 'local-llm-interface-snippets');
            fs.mkdirSync(snippetDir, { recursive: true });

            const snippetFileName = `html_snippet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.html`;
            const snippetFilePath = path.join(snippetDir, snippetFileName);
            fs.writeFileSync(snippetFilePath, code, 'utf-8');

            const snippetUrl = pathToFileURL(snippetFilePath).toString();
            await electron.shell.openExternal(snippetUrl);

            return {
                stdout: `Successfully opened HTML snippet in default browser. Path: ${snippetFilePath}`,
                stderr: '',
            };
        } catch (error) {
            const errorMessage = `Failed to open HTML snippet: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            return { stdout: '', stderr: errorMessage };
        }
    });

    electron.ipcMain.handle('api:make-request', async (_, req: ApiRequest): Promise<ApiResponse> => {
        console.log('Making API request:', req);
        const { url, method, headers, body } = req;
        const requestModule = url.startsWith('https') ? httpsRequest : httpRequest;

        return new Promise((resolve) => {
            try {
                const request = requestModule(url, { method, headers }, (res) => {
                    let responseBody = '';
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        responseBody += chunk;
                    });
                    res.on('end', () => {
                        resolve({
                            status: res.statusCode || 500,
                            statusText: res.statusMessage || 'Unknown Status',
                            headers: res.headers,
                            body: responseBody,
                        });
                    });
                });

                request.on('error', (e) => {
                     resolve({
                        status: 500,
                        statusText: 'Request Error',
                        headers: {},
                        body: e.message,
                    });
                });
                
                if (body) {
                    request.write(body);
                }
                
                request.end();

            } catch (e) {
                 resolve({
                    status: 500,
                    statusText: 'Client Error',
                    headers: {},
                    body: e instanceof Error ? e.message : String(e),
                });
            }
        });
    });
    
    electron.ipcMain.handle('provider:health-check', async (_, baseUrl: string): Promise<boolean> => {
        // A simple health check. We don't care about the response body, just that the server is listening.
        return new Promise((resolve) => {
            try {
                const url = new URL(baseUrl);
                // Most local services are http, but this supports both
                const requestModule = url.protocol === 'https:' ? httpsRequest : httpRequest;

                const req = requestModule(
                    url,
                    { method: 'HEAD', timeout: 3000 }, // 3 second timeout
                    (res) => {
                        // Any response, even an error status code, means the server is online.
                        // We just want to know if it's reachable.
                        res.resume(); // Discard response body
                        resolve(true);
                    }
                );

                req.on('timeout', () => {
                    req.destroy();
                    resolve(false);
                });

                req.on('error', (e) => {
                    // e.g., ECONNREFUSED
                    resolve(false);
                });

                req.end();
            } catch (e) {
                // Invalid URL etc.
                console.error(`Health check failed for invalid URL "${baseUrl}":`, e);
                resolve(false);
            }
        });
    });

    electron.ipcMain.handle('settings:export', async (_, settings) => {
        try {
            const { canceled, filePath } = await electron.dialog.showSaveDialog({
                title: 'Export Settings',
                defaultPath: 'settings.json',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
            });

            if (canceled || !filePath) {
                return { success: true }; // Not an error, user just canceled
            }

            await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
            return { success: true };
        } catch (error) {
            console.error('Failed to export settings:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    electron.ipcMain.handle('settings:import', async () => {
        try {
            const { canceled, filePaths } = await electron.dialog.showOpenDialog({
                title: 'Import Settings',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
                properties: ['openFile'],
            });

            if (canceled || !filePaths || filePaths.length === 0) {
                return { success: true, content: null }; // Canceled
            }
            
            const filePath = filePaths[0];
            const content = await readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            console.error('Failed to import settings:', error);
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    // --- Window Control Handlers ---
    electron.ipcMain.handle('window:minimize', () => mainWindowInstance?.minimize());
    electron.ipcMain.handle('window:maximize', () => mainWindowInstance?.maximize());
    electron.ipcMain.handle('window:unmaximize', () => mainWindowInstance?.unmaximize());
    electron.ipcMain.handle('window:close', () => mainWindowInstance?.close());

    // --- Update Handlers ---
    electron.ipcMain.handle('updates:check', () => {
        if (!electron.app.isPackaged) {
            console.log('Update check skipped: App is not packaged.');
            mainWindowInstance?.webContents.send('update-not-available', { version: electron.app.getVersion() });
            return;
        }
        configureAutoUpdater();
        return autoUpdater.checkForUpdates();
    });
    
    electron.ipcMain.handle('updates:install', () => {
        autoUpdater.quitAndInstall();
    });


    // Project Management Handlers
    electron.ipcMain.handle('dialog:select-directory', async () => {
        const { canceled, filePaths } = await electron.dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!canceled && filePaths.length > 0) {
            return filePaths[0];
        }
        return null;
    });

    electron.ipcMain.handle('project:create', async (_, { projectType, name, basePath }: { projectType: ProjectType, name: string, basePath: string }) => {
        const projectPath = path.join(basePath, name);
        if (fs.existsSync(projectPath)) {
            throw new Error(`Project directory already exists: ${projectPath}`);
        }
        fs.mkdirSync(projectPath, { recursive: true });

        try {
            if (projectType === 'python') {
                const settings: any = readSettings();
                const pythonCommand = settings?.selectedPythonPath || 'python';
                const venvPath = path.join(projectPath, 'venv');
                const { stderr } = await runCommand(pythonCommand, ['-m', 'venv', venvPath], projectPath);
                if (stderr) throw new Error(stderr);
            } else if (projectType === 'nodejs') {
                const settings: any = readSettings();
                const npmCommand = settings.selectedNodePath ? path.join(path.dirname(settings.selectedNodePath), 'npm') : 'npm';
                const { stderr } = await runCommand(npmCommand, ['init', '-y'], projectPath);
                if (stderr) throw new Error(stderr);
            } else if (projectType === 'java') {
                 // Create Maven structure and files
                const srcPath = path.join(projectPath, 'src/main/java/com/example');
                fs.mkdirSync(srcPath, { recursive: true });

                const pomContent = `
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>${name}</artifactId>
  <version>1.0-SNAPSHOT</version>
  <properties>
    <maven.compiler.source>1.8</maven.compiler.source>
    <maven.compiler.target>1.8</maven.compiler.target>
  </properties>
  <build>
    <plugins>
      <plugin>
        <groupId>org.codehaus.mojo</groupId>
        <artifactId>exec-maven-plugin</artifactId>
        <version>3.0.0</version>
        <configuration>
          <mainClass>com.example.Main</mainClass>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>`;
                fs.writeFileSync(path.join(projectPath, 'pom.xml'), pomContent);
                
                const mainJavaContent = `package com.example;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java World from ${name}!");
    }
}`;
                fs.writeFileSync(path.join(srcPath, 'Main.java'), mainJavaContent);

            } else if (projectType === 'delphi') {
                const dprContent = `program ${name};

{$APPTYPE CONSOLE}

uses
  System.SysUtils;

begin
  try {
    WriteLn('Hello from ${name}!');
  } except
    on E: Exception do
      WriteLn(E.ClassName, ': ', E.Message);
  end;
end.
`;
                fs.writeFileSync(path.join(projectPath, `${name}.dpr`), dprContent);
            } else if (projectType === 'webapp') {
                 fs.writeFileSync(path.join(projectPath, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name}</title>
</head>
<body>
    <h1>Welcome to ${name}</h1>
</body>
</html>`);
            }
        } catch (e: any) {
            // Clean up created directory on failure
            if (fs.existsSync(projectPath)) {
              fs.rmSync(projectPath, { recursive: true, force: true });
            }
            throw new Error(`Failed to create project: ${e.message}`);
        }
        
        return {
            id: crypto.randomBytes(8).toString('hex'),
            name,
            type: projectType,
            path: projectPath,
        };
    });

    electron.ipcMain.handle('project:delete', async (_, projectPath: string) => {
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
    });

    electron.ipcMain.handle('project:open-folder', async (_, folderPath: string) => {
        electron.shell.openPath(folderPath);
    });
    
    const isPathInAllowedBase = (filePath: string) => {
        const settings = readSettings() as any;
        if (!settings) return false;
        const allowedBasePaths = [
            settings.pythonProjectsPath, 
            settings.nodejsProjectsPath, 
            settings.webAppsPath,
            settings.javaProjectsPath,
            settings.delphiProjectsPath
        ].filter(Boolean);
        // Normalize paths to handle different OS path separators
        const normalizedFilePath = path.normalize(filePath);
        return allowedBasePaths.some(base => normalizedFilePath.startsWith(path.normalize(base) + path.sep));
    };
    
    electron.ipcMain.handle('project:open-webapp', async (_, projectPath: string) => {
        const indexPath = path.join(projectPath, 'index.html');
        if (isPathInAllowedBase(projectPath) && fs.existsSync(indexPath)) {
            await openPathInBrowser(indexPath);
        } else {
            throw new Error(`index.html not found in project or path is not allowed: ${projectPath}`);
        }
    });

    electron.ipcMain.handle('project:install-deps', async (_, project: CodeProject) => {
        const settings: any = readSettings();
        if (project.type === 'python') {
            const reqFile = path.join(project.path, 'requirements.txt');
            if (!fs.existsSync(reqFile)) {
                fs.writeFileSync(reqFile, '# Add your python dependencies here');
                return { stdout: 'Created empty requirements.txt.', stderr: '' };
            }
            const venvPath = path.join(project.path, 'venv');
            const pythonExec = getPythonExecutable(venvPath);
            return await runCommand(pythonExec, ['-m', 'pip', 'install', '-r', 'requirements.txt'], project.path);
        } else if (project.type === 'nodejs') {
            const npmCommand = settings.selectedNodePath ? path.join(path.dirname(settings.selectedNodePath), 'npm') : 'npm';
            return await runCommand(npmCommand, ['install'], project.path);
        } else if (project.type === 'java') {
            const mvnCommand = 'mvn'; // Assuming mvn is in PATH. A specific path from settings could be used here.
            return await runCommand(mvnCommand, ['install'], project.path);
        }
        return { stdout: '', stderr: `Dependency installation is not applicable for project type: ${project.type}` };
    });
    
    electron.ipcMain.handle('project:run', async (_, project: CodeProject): Promise<{ stdout: string; stderr: string }> => {
        const settings: any = readSettings();
        if (!isPathInAllowedBase(project.path)) {
            return { stdout: '', stderr: 'Execution denied: project path is not in an allowed base directory.' };
        }
        
        if (project.type === 'webapp') {
            const indexPath = path.join(project.path, 'index.html');
            if (fs.existsSync(indexPath)) {
                await openPathInBrowser(indexPath);
                return { stdout: `Successfully opened ${indexPath} in the default browser.`, stderr: '' };
            }
            return { stdout: '', stderr: `Could not find index.html in ${project.path}` };
        }
        
        if (project.type === 'python') {
            const entryPoints = ['main.py', 'app.py'];
            const entryFile = entryPoints.find(f => fs.existsSync(path.join(project.path, f)));
            if (!entryFile) {
                return { stdout: '', stderr: `Could not find an entry point (e.g., ${entryPoints.join(', ')}) in project.` };
            }
            if (os.platform() === 'win32') {
                const activateScript = path.join('venv', 'Scripts', 'activate.bat');
                const commandToRun = `"${activateScript}" && python ${entryFile}`;
                return runInExternalConsole(commandToRun, project.path);
            } else {
                console.log(`External console only implemented for Windows. Falling back to integrated execution for ${os.platform()}.`);
                const pythonExec = getPythonExecutable(path.join(project.path, 'venv'));
                return runCommand(pythonExec, [entryFile], project.path);
            }
        }
        
        if (project.type === 'nodejs') {
            const packageJsonPath = path.join(project.path, 'package.json');
            const nodeCommand = settings.selectedNodePath || 'node';
            const npmCommand = settings.selectedNodePath ? path.join(path.dirname(settings.selectedNodePath), 'npm') : 'npm';
            
            // 1. Try `npm run start` first, as it's the standard.
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    if (pkg.scripts && pkg.scripts.start) {
                        console.log(`Found 'start' script in package.json. Running 'npm start' for ${project.name}`);
                        return runCommand(npmCommand, ['start'], project.path);
                    }
                } catch (e) {
                    return { stdout: '', stderr: `Error reading package.json: ${e instanceof Error ? e.message : String(e)}` };
                }
            }
            
            // 2. If no start script, try to find a script entry point (.ts or .js)
            let entryFile: string | undefined;
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    if (pkg.main) {
                        entryFile = pkg.main;
                    }
                } catch (e) { /* ignore if we can't parse, will fall back to file search */ }
            }
            
            if (!entryFile) {
                const scriptEntryPoints = ['index.ts', 'main.ts', 'app.ts', 'server.ts', 'index.js', 'main.js', 'app.js', 'server.js'];
                entryFile = scriptEntryPoints.find(f => fs.existsSync(path.join(project.path, f)));
            }
            
            // If a script is found, run it with the appropriate runner.
            if (entryFile) {
                if (entryFile.endsWith('.ts')) {
                    console.log(`Found TypeScript entry file: ${entryFile}. Running with 'npx ts-node'.`);
                    const npxCommand = settings.selectedNodePath ? path.join(path.dirname(settings.selectedNodePath), 'npx') : 'npx';
                    return runCommand(npxCommand, ['ts-node', entryFile], project.path);
                } else { // .js file
                    console.log(`Found JavaScript entry file: ${entryFile}. Running with 'node'.`);
                    return runCommand(nodeCommand, [entryFile], project.path);
                }
            }

            // 3. As a fallback for nodejs projects, check for an index.html file.
            const indexPath = path.join(project.path, 'index.html');
            if (fs.existsSync(indexPath)) {
                console.log(`No script entry point found for nodejs project ${project.name}, but found index.html. Opening in browser.`);
                await openPathInBrowser(indexPath);
                return { stdout: `No script found. Opened ${indexPath} in the default browser.`, stderr: '' };
            }

            // 4. If nothing runnable is found, return an error.
            return { stdout: '', stderr: `Could not find an entry point. Looked for: 'npm start' script, common script files (e.g., index.js, index.ts), or an index.html file.` };
        }
        
        if (project.type === 'java') {
            // Note: This requires Maven to be installed on the user's system and in their PATH.
            return runCommand('mvn', ['compile', 'exec:java'], project.path);
        }
        
        if (project.type === 'delphi') {
            if (!settings?.selectedDelphiPath) {
                return { stdout: '', stderr: 'Delphi compiler path not set. Please configure it in Settings > Advanced > Toolchains.' };
            }
            const compilerPath = path.join(settings.selectedDelphiPath, 'bin', 'dcc32.exe');
            if (!fs.existsSync(compilerPath)) {
                return { stdout: '', stderr: `Delphi compiler not found at expected path: ${compilerPath}` };
            }
            const dprFile = `${project.name}.dpr`;
            const dprPath = path.join(project.path, dprFile);
            if (!fs.existsSync(dprPath)) {
                return { stdout: '', stderr: `Project file not found: ${dprPath}` };
            }
            
            console.log(`Compiling Delphi project: ${dprFile} with compiler ${compilerPath}`);
            // On Windows, the path must be quoted if it contains spaces, which is common for Program Files.
            const command = os.platform() === 'win32' ? `"${compilerPath}"` : compilerPath;
            return runCommand(command, ['-B', '-Q', dprFile], project.path);
        }

        return { stdout: '', stderr: `Project type "${project.type}" cannot be run.` };
    });

    electron.ipcMain.handle('project:run-script', async (_, { project, code }: { project: CodeProject, code: string }) => {
        const settings: any = readSettings();
        const extension = project.type === 'python' ? 'py' : project.type === 'java' ? 'java' : 'js';
        const tempFileName = `script_${crypto.randomBytes(6).toString('hex')}.${extension}`;
        const tempFilePath = path.join(project.path, tempFileName);
        
        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            if (project.type === 'python') {
                const pythonExec = getPythonExecutable(path.join(project.path, 'venv'));
                return await runCommand(pythonExec, [tempFilePath], project.path);
            } else if (project.type === 'nodejs') {
                const nodeCommand = settings.selectedNodePath || 'node';
                return await runCommand(nodeCommand, [tempFilePath], project.path);
            } else {
                 return { stdout: '', stderr: `Running standalone scripts is not supported for project type: ${project.type}`};
            }
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });

    // File System Handlers for Project Viewer
    electron.ipcMain.handle('project:read-dir', async (_, dirPath: string) => {
        if (!isPathInAllowedBase(dirPath)) throw new Error('Access denied to path.');
        
        const dirents = await readdir(dirPath, { withFileTypes: true });
        const files = await Promise.all(dirents.map(async (dirent) => {
            if (ignoredDirsAndFiles.has(dirent.name)) {
                return null;
            }
            return {
                name: dirent.name,
                path: path.join(dirPath, dirent.name),
                isDirectory: dirent.isDirectory(),
            };
        }));

        return files.filter(Boolean).sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    });

    electron.ipcMain.handle('project:read-file', async (_, filePath: string) => {
        if (!isPathInAllowedBase(filePath)) throw new Error('Access denied to path.');
        return await readFile(filePath, 'utf-8');
    });

    electron.ipcMain.handle('project:write-file', async (_, filePath: string, content: string) => {
        const dirPath = path.dirname(filePath);
        if (!isPathInAllowedBase(dirPath)) throw new Error('Access denied to path.');
        
        await mkdir(dirPath, { recursive: true });
        await writeFile(filePath, content, 'utf-8');
    });

    electron.ipcMain.handle('project:add-file-from-path', async (_, { sourcePath, targetDir }: { sourcePath: string, targetDir: string }) => {
        if (!isPathInAllowedBase(targetDir)) throw new Error('Access denied to path.');
        const targetPath = path.join(targetDir, path.basename(sourcePath));
        await copyFile(sourcePath, targetPath);
    });
    
    const getAllFilesRecursive = async (dirPath: string): Promise<{name: string, path: string}[]> => {
        let files: {name: string, path: string}[] = [];
        try {
            const dirents = await readdir(dirPath, { withFileTypes: true });
            for (const dirent of dirents) {
                if (ignoredDirsAndFiles.has(dirent.name)) continue;
                
                const fullPath = path.join(dirPath, dirent.name);
                if (dirent.isDirectory()) {
                    files = files.concat(await getAllFilesRecursive(fullPath));
                } else {
                    files.push({ name: dirent.name, path: fullPath });
                }
            }
        } catch (error) {
            console.error(`Error getting all files for ${dirPath}:`, error);
        }
        return files;
    };
    
    electron.ipcMain.handle('project:get-all-files', async (_, projectPath: string) => {
        if (!isPathInAllowedBase(projectPath)) throw new Error('Access denied to path.');
        return await getAllFilesRecursive(projectPath);
    });

    electron.ipcMain.handle('project:list-files-recursive', async (_, projectPath: string): Promise<string[]> => {
        if (!isPathInAllowedBase(projectPath)) throw new Error('Access denied to path.');
        const allFiles = await getAllFilesRecursive(projectPath);
        return allFiles.map(f => path.relative(projectPath, f.path));
    });

    electron.ipcMain.handle('project:run-command', async (_, { projectPath, command }: { projectPath: string, command: string }) => {
        if (!isPathInAllowedBase(projectPath)) throw new Error('Access denied to path.');
        const [cmd, ...args] = command.split(' ');
        console.log(`Running command in project: ${cmd} with args: ${args.join(' ')} in ${projectPath}`);
        return await runCommand(cmd, args, projectPath);
    });

    electron.ipcMain.handle('project:find-file', async (_, { projectPath, fileName }: { projectPath: string, fileName: string }) => {
        if (!isPathInAllowedBase(projectPath)) throw new Error('Access denied to path.');
        const allFiles = await getAllFilesRecursive(projectPath);
        // Find a file that ends with the requested fileName. This allows for partial paths like `src/utils.js`
        const foundFile = allFiles.find(f => f.path.endsWith(path.normalize(fileName)));
        return foundFile ? foundFile.path : null;
    });

    const generateFileTree = async (dirPath: string, prefix = ''): Promise<string> => {
        let tree = '';
        try {
            const dirents = (await readdir(dirPath, { withFileTypes: true }))
                .filter(d => !ignoredDirsAndFiles.has(d.name) && !d.name.startsWith('.'));
                
            dirents.sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            for (let i = 0; i < dirents.length; i++) {
                const dirent = dirents[i];
                const isLast = i === dirents.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                tree += `${prefix}${connector}${dirent.name}\n`;

                if (dirent.isDirectory()) {
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    tree += await generateFileTree(path.join(dirPath, dirent.name), newPrefix);
                }
            }
        } catch (error) {
            console.error(`Error generating file tree for ${dirPath}:`, error);
            return `[Error reading directory: ${dirPath}]`;
        }
        return tree;
    };

    electron.ipcMain.handle('project:get-file-tree', async (_, projectPath: string) => {
        if (!isPathInAllowedBase(projectPath)) throw new Error('Access denied to path.');
        const projectName = path.basename(projectPath);
        const tree = await generateFileTree(projectPath);
        return `${projectName}/\n${tree}`;
    });


    createWindow();

    // Check for app updates when the app is packaged.
    if (electron.app.isPackaged) {
      configureAutoUpdater();
      const settings = readSettings() as any;
      const autoCheckEnabled = settings?.autoCheckForUpdates !== false;
      if (autoCheckEnabled) {
        autoUpdater.checkForUpdates();
      } else {
        console.log('Automatic update checks are disabled in settings.');
      }
    }

    // Re-create a window on macOS when the dock icon is clicked and there are no other windows open.
    electron.app.on('activate', () => {
        if (electron.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// --- AutoUpdater Event Listeners ---
autoUpdater.on('update-available', (info) => {
    mainWindowInstance?.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
    mainWindowInstance?.webContents.send('update-not-available', info);
});

autoUpdater.on('error', (err) => {
    mainWindowInstance?.webContents.send('update-error', err);
});

autoUpdater.on('download-progress', (progressObj) => {
    mainWindowInstance?.webContents.send('update-download-progress', {
        percent: Math.round(progressObj.percent),
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
    });
    console.log(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`);
});

autoUpdater.on('update-downloaded', (info) => {
    hasSentDownloadingMessage = false; // Reset for the next update cycle
    mainWindowInstance?.webContents.send('update-downloaded', info);
});


// Quit when all windows are closed, except on macOS.
electron.app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') {
    electron.app.quit();
  }
});

electron.app.on('will-quit', () => {
  electron.globalShortcut.unregisterAll();
});

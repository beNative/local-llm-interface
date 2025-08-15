

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
import * as path from 'path';
import * as fs from 'fs';
import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import * as os from 'os';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import type { IncomingHttpHeaders } from 'http';
import type { ApiRequest, ApiResponse, CodeProject, ProjectType } from '../src/types';


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

const runCommand = (command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr:string }> => {
    return new Promise((resolve) => {
        const child = spawn(command, args, { cwd, shell: os.platform() === 'win32' });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
        
        child.on('error', (error) => {
            console.error(`Spawn error for ${command}`, error);
            stderr += `\nFailed to start command: ${error.message}`;
            resolve({ stdout, stderr });
        });

        child.on('close', (code) => {
            if (code !== 0) {
                 stderr += `\nProcess exited with non-zero code: ${code}`;
            }
            resolve({ stdout, stderr });
        });
    });
};

const getPythonExecutable = (venvPath: string): string => {
    if (os.platform() === 'win32') {
        return path.join(venvPath, 'Scripts', 'python.exe');
    }
    return path.join(venvPath, 'bin', 'python');
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
        const settings: any = readSettings();
        const pythonCommand = settings?.pythonCommand || 'python';

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

    ipcMain.handle('nodejs:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        const tempDir = os.tmpdir();
        const tempFileName = `nodescript_${crypto.randomBytes(6).toString('hex')}.js`;
        const tempFilePath = path.join(tempDir, tempFileName);

        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            return await new Promise((resolve, reject) => {
                const child = spawn('node', [tempFilePath], { shell: os.platform() === 'win32' });
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
    
    ipcMain.handle('html:run', async (_, code: string): Promise<{ stdout: string; stderr: string }> => {
        const tempDir = os.tmpdir();
        const tempFileName = `html_snippet_${crypto.randomBytes(6).toString('hex')}.html`;
        const tempFilePath = path.join(tempDir, tempFileName);

        try {
            fs.writeFileSync(tempFilePath, code, 'utf-8');
            await shell.openPath(tempFilePath);
            // We don't delete the temp file so the browser has time to load it.
            // The OS will clean up the temp directory eventually.
            return {
                stdout: `Successfully opened HTML snippet in default browser. Path: ${tempFilePath}`,
                stderr: '',
            };
        } catch (error) {
            const errorMessage = `Failed to open HTML snippet: ${error instanceof Error ? error.message : String(error)}`;
            console.error(errorMessage);
            return { stdout: '', stderr: errorMessage };
        }
    });

    ipcMain.handle('api:make-request', async (_, req: ApiRequest): Promise<ApiResponse> => {
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

    // Project Management Handlers
    ipcMain.handle('dialog:select-directory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (!canceled && filePaths.length > 0) {
            return filePaths[0];
        }
        return null;
    });

    ipcMain.handle('project:create', async (_, { projectType, name, basePath }: { projectType: ProjectType, name: string, basePath: string }) => {
        const projectPath = path.join(basePath, name);
        if (fs.existsSync(projectPath)) {
            throw new Error(`Project directory already exists: ${projectPath}`);
        }
        fs.mkdirSync(projectPath, { recursive: true });

        try {
            if (projectType === 'python') {
                const settings: any = readSettings();
                const pythonCommand = settings?.pythonCommand || 'python';
                const venvPath = path.join(projectPath, 'venv');
                const { stderr } = await runCommand(pythonCommand, ['-m', 'venv', venvPath], projectPath);
                if (stderr) throw new Error(stderr);
            } else if (projectType === 'nodejs') {
                const { stderr } = await runCommand('npm', ['init', '-y'], projectPath);
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

    ipcMain.handle('project:delete', async (_, projectPath: string) => {
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
    });

    ipcMain.handle('project:open-folder', async (_, folderPath: string) => {
        shell.openPath(folderPath);
    });
    
    const isPathInAllowedBase = (filePath: string) => {
        const settings = readSettings() as any;
        if (!settings) return false;
        const allowedBasePaths = [
            settings.pythonProjectsPath, 
            settings.nodejsProjectsPath, 
            settings.webAppsPath,
            settings.javaProjectsPath
        ].filter(Boolean);
        // Normalize paths to handle different OS path separators
        const normalizedFilePath = path.normalize(filePath);
        return allowedBasePaths.some(base => normalizedFilePath.startsWith(path.normalize(base) + path.sep));
    };
    
    ipcMain.handle('project:open-webapp', async (_, projectPath: string) => {
        const indexPath = path.join(projectPath, 'index.html');
        if (isPathInAllowedBase(projectPath) && fs.existsSync(indexPath)) {
            shell.openPath(indexPath);
        } else {
            throw new Error(`index.html not found in project or path is not allowed: ${projectPath}`);
        }
    });

    ipcMain.handle('project:install-deps', async (_, project: CodeProject) => {
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
            return await runCommand('npm', ['install'], project.path);
        } else if (project.type === 'java') {
            return await runCommand('mvn', ['install'], project.path);
        }
        return { stdout: '', stderr: 'Unknown project type' };
    });
    
    ipcMain.handle('project:run', async (_, project: CodeProject): Promise<{ stdout: string; stderr: string }> => {
        if (!isPathInAllowedBase(project.path)) {
            return { stdout: '', stderr: 'Execution denied: project path is not in an allowed base directory.' };
        }
        
        if (project.type === 'webapp') {
            const indexPath = path.join(project.path, 'index.html');
            if (fs.existsSync(indexPath)) {
                shell.openPath(indexPath);
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
            const pythonExec = getPythonExecutable(path.join(project.path, 'venv'));
            return runCommand(pythonExec, [entryFile], project.path);
        }
        
        if (project.type === 'nodejs') {
            const packageJsonPath = path.join(project.path, 'package.json');
            
            // 1. Try `npm run start` first, as it's the standard.
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    if (pkg.scripts && pkg.scripts.start) {
                        console.log(`Found 'start' script in package.json. Running 'npm start' for ${project.name}`);
                        return runCommand('npm', ['start'], project.path);
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
                    return runCommand('npx', ['ts-node', entryFile], project.path);
                } else { // .js file
                    console.log(`Found JavaScript entry file: ${entryFile}. Running with 'node'.`);
                    return runCommand('node', [entryFile], project.path);
                }
            }

            // 3. As a fallback for nodejs projects, check for an index.html file.
            const indexPath = path.join(project.path, 'index.html');
            if (fs.existsSync(indexPath)) {
                console.log(`No script entry point found for nodejs project ${project.name}, but found index.html. Opening in browser.`);
                shell.openPath(indexPath);
                return { stdout: `No script found. Opened ${indexPath} in the default browser.`, stderr: '' };
            }

            // 4. If nothing runnable is found, return an error.
            return { stdout: '', stderr: `Could not find an entry point. Looked for: 'npm start' script, common script files (e.g., index.js, index.ts), or an index.html file.` };
        }
        
        if (project.type === 'java') {
            // Note: This requires Maven to be installed on the user's system and in their PATH.
            return runCommand('mvn', ['compile', 'exec:java'], project.path);
        }

        return { stdout: '', stderr: `Project type "${project.type}" cannot be run.` };
    });

    ipcMain.handle('project:run-script', async (_, { project, code }: { project: CodeProject, code: string }) => {
        const extension = project.type === 'python' ? 'py' : project.type === 'java' ? 'java' : 'js';
        const tempFileName = `script_${crypto.randomBytes(6).toString('hex')}.${extension}`;
        const tempFilePath = path.join(project.path, tempFileName);
        
        fs.writeFileSync(tempFilePath, code, 'utf-8');

        try {
            if (project.type === 'python') {
                const pythonExec = getPythonExecutable(path.join(project.path, 'venv'));
                return await runCommand(pythonExec, [tempFilePath], project.path);
            } else if (project.type === 'nodejs') {
                return await runCommand('node', [tempFilePath], project.path);
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
    ipcMain.handle('project:read-dir', async (_, dirPath: string) => {
        if (!isPathInAllowedBase(dirPath)) throw new Error('Access denied to path.');
        
        const dirents = await readdir(dirPath, { withFileTypes: true });
        const files = await Promise.all(dirents.map(async (dirent) => {
            if (dirent.name === '.git' || dirent.name === 'node_modules' || dirent.name === 'venv' || dirent.name.startsWith('.') || dirent.name === 'target') {
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

    ipcMain.handle('project:read-file', async (_, filePath: string) => {
        if (!isPathInAllowedBase(filePath)) throw new Error('Access denied to path.');
        return await readFile(filePath, 'utf-8');
    });

    ipcMain.handle('project:write-file', async (_, { filePath, content }: { filePath: string, content: string }) => {
        const dirPath = path.dirname(filePath);
        if (!isPathInAllowedBase(dirPath)) throw new Error('Access denied to path.');
        
        await mkdir(dirPath, { recursive: true });
        await writeFile(filePath, content, 'utf-8');
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
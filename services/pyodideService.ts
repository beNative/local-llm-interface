import type { PyodideInterface } from 'pyodide/pyodide';
import { logger } from './logger';

// Make loadPyodide available from window after the script is loaded
declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<PyodideInterface>;
    }
}

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

const loadPyodideInstance = async (): Promise<PyodideInterface> => {
    if (pyodideInstance) {
        return pyodideInstance;
    }
    if (pyodideLoadingPromise) {
        return pyodideLoadingPromise;
    }

    logger.info('Loading Pyodide runtime...');
    pyodideLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './pyodide/pyodide.js';
        script.onload = () => {
            window.loadPyodide({
                indexURL: './pyodide/',
            }).then((instance) => {
                logger.info('Pyodide runtime loaded successfully.');
                pyodideInstance = instance;
                pyodideLoadingPromise = null;
                resolve(instance);
            }).catch((error) => {
                logger.error(`Failed to initialize Pyodide: ${error}`);
                pyodideLoadingPromise = null;
                reject(error);
            });
        };
        script.onerror = () => {
            const error = new Error("Failed to load Pyodide script from ./pyodide/pyodide.js");
            logger.error(error);
            pyodideLoadingPromise = null;
            reject(error);
        };
        document.body.appendChild(script);
    });

    return pyodideLoadingPromise;
};

export const runPythonCode = async (code: string): Promise<{ result: string, error: string | null }> => {
    try {
        const pyodide = await loadPyodideInstance();
        
        let stdout = '';
        let stderr = '';
        pyodide.setStdout({ batched: (str) => { stdout += str + '\n'; } });
        pyodide.setStderr({ batched: (str) => { stderr += str + '\n'; } });

        logger.info('Executing code in Pyodide...');
        const result = await pyodide.runPythonAsync(code);
        
        pyodide.setStdout({});
        pyodide.setStderr({});
        
        let finalOutput = stdout;
        if (result !== undefined && result !== null) {
            finalOutput += String(result);
        }

        const finalError = stderr ? `Error: ${stderr}` : null;
        logger.info('Pyodide execution finished.');
        
        return { result: finalOutput.trim(), error: finalError };
    } catch (err) {
        const errorMsg = err instanceof Error ? `Error: ${err.message}` : 'An unknown error occurred during Python execution.';
        logger.error(`Pyodide execution failed: ${errorMsg}`);
        return { result: '', error: errorMsg };
    }
};
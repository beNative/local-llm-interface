import type { PyodideInterface } from 'pyodide';

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

    pyodideLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './pyodide/pyodide.js';
        script.onload = () => {
            window.loadPyodide({
                indexURL: './pyodide/',
            }).then((instance) => {
                pyodideInstance = instance;
                pyodideLoadingPromise = null;
                resolve(instance);
            }).catch((error) => {
                pyodideLoadingPromise = null;
                reject(error);
            });
        };
        script.onerror = () => {
            pyodideLoadingPromise = null;
            reject(new Error("Failed to load Pyodide script"));
        };
        document.body.appendChild(script);
    });

    return pyodideLoadingPromise;
};

export const runPythonCode = async (code: string): Promise<{ result: string, error: string | null }> => {
    try {
        const pyodide = await loadPyodideInstance();
        
        // Capture stdout and stderr
        let stdout = '';
        let stderr = '';
        pyodide.setStdout({ batched: (str) => { stdout += str + '\n'; } });
        pyodide.setStderr({ batched: (str) => { stderr += str + '\n'; } });

        const result = await pyodide.runPythonAsync(code);
        
        // Reset streams
        pyodide.setStdout({});
        pyodide.setStderr({});
        
        let finalOutput = stdout;
        if (result !== undefined && result !== null) {
            finalOutput += String(result);
        }

        const finalError = stderr ? `Error: ${stderr}` : null;
        
        return { result: finalOutput.trim(), error: finalError };
    } catch (err) {
        if (err instanceof Error) {
            return { result: '', error: `Error: ${err.message}` };
        }
        return { result: '', error: 'An unknown error occurred during Python execution.' };
    }
};
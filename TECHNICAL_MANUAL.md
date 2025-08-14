# Technical Manual

This document describes the technical architecture of the Local LLM Interface application.

## 1. High-Level Architecture

The application is an [Electron](https://www.electronjs.org/) application that wraps a [React](https://reactjs.org/) single-page application (SPA). This allows for a rich, modern user interface built with web technologies, while also granting the low-level system access of a desktop application (e.g., for file I/O and running native processes).

- **Main Process**: The Electron main process (`electron/main.ts`) is the backend of the application. It manages the application lifecycle, creates the browser window, and handles all interactions with the operating system.
- **Renderer Process**: The React application (`index.tsx` and all `src/` files) runs in the Electron browser window. It is responsible for the entire user interface and user experience. It cannot directly access Node.js or OS-level APIs.
- **Preload Script**: The preload script (`electron/preload.ts`) is a bridge between the renderer and main processes. It uses Electron's `contextBridge` to securely expose specific Node.js/Electron functionalities from the main process to the renderer process.

## 2. Technology Stack

- **Electron**: Core framework for building the cross-platform desktop app.
- **React**: Library for building the user interface.
- **TypeScript**: For static typing and improved code quality.
- **esbuild**: A very fast JavaScript/TypeScript bundler used for building the main, renderer, and preload scripts.
- **TailwindCSS**: A utility-first CSS framework for styling the application.
- **Pyodide**: A port of CPython to WebAssembly, used for running Python code within the browser sandbox.

## 3. Project Structure

- `dist/`: The output directory for all bundled and copied files, which Electron runs.
- `electron/`: Contains code for the Electron-specific parts.
  - `main.ts`: The main process entry point.
  - `preload.ts`: The context bridge script.
- `src/` (aliased in `esbuild.config.js` to root): Contains all the React application source code.
  - `components/`: Reusable React components.
  - `services/`: Modules for handling business logic (API calls, logging, etc.).
  - `types.ts`: TypeScript type definitions.
  - `constants.ts`: Application-wide constants.
  - `App.tsx`: The root React component, which manages global state.
  - `index.tsx`: The entry point for the React application.
- `esbuild.config.js`: The build script configuration.
- `package.json`: Project metadata and dependencies.

## 4. State Management

The application employs a simple, centralized state management model. The root `App.tsx` component holds all major application state (e.g., `config`, `models`, `messages`, `currentView`) using React's `useState` hook. State and state-updating functions are passed down to child components as props.

## 5. Electron IPC (Inter-Process Communication)

The renderer process is sandboxed and cannot directly access Node.js APIs. Communication with the main process is handled via IPC:

- `electron/preload.ts` exposes a `window.electronAPI` object to the renderer.
- This API includes functions like `getSettings`, `saveSettings`, `runPython`, and `writeLog`.
- When a renderer function like `window.electronAPI.runPython(code)` is called, it sends an IPC message to the main process via `ipcRenderer.invoke`.
- The main process listens for these messages with `ipcMain.handle`. For example, the `python:run` handler receives the code, executes it in a native child process, and returns the result.

## 6. Services Deep Dive

- **`llmService.ts`**: Handles all communication with the LLM server.
  - `fetchModels`: Sends a GET request to the `/models` endpoint.
  - `streamChatCompletion`: Sends a POST request to `/chat/completions` with `stream: true`. It uses the Fetch API's `ReadableStream` to process chunks of data as they arrive, providing a real-time chat experience.
- **`pyodideService.ts`**: Manages running Python code in the browser. It lazily loads the Pyodide runtime and scripts on the first execution request to keep the initial app load fast.
- **`logger.ts`**: Implemented as a singleton class. It maintains an in-memory array of log entries and uses a subscriber pattern to notify components (like the `LoggingPanel`) of new logs. When file logging is enabled, it uses an IPC call (`log:write`) to ask the main process to append the log entry to a file.

## 7. Build Process

The `esbuild.config.js` script handles the entire build process:
1.  Cleans the `dist/` directory.
2.  Copies static assets (`index.html`, Pyodide files, and documentation) to `dist/`.
3.  Bundles and transpiles the TypeScript code for the main, preload, and renderer processes into JavaScript files in `dist/`.

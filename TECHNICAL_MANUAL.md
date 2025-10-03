# Technical Manual

This document describes the technical architecture of the Local LLM Interface application.

## 1. High-Level Architecture

The application is an [Electron](https://www.electronjs.org/) application that wraps a [React](https://reactjs.org/) single-page application (SPA). This allows for a rich, modern user interface built with web technologies, while also granting the low-level system access of a desktop application (e.g., for file I/O and running native processes).

- **Main Process**: The Electron main process (`electron/main.ts`) is the backend of the application. It manages the application lifecycle, creates the browser window, and handles all interactions with the operating system.
- **Renderer Process**: The React application (`index.tsx` and all component files) runs in the Electron browser window. It is responsible for the entire user interface and user experience. It cannot directly access Node.js or OS-level APIs.
- **Preload Script**: The preload script (`electron/preload.ts`) is a bridge between the renderer and main processes. It uses Electron's `contextBridge` to securely expose specific Node.js/Electron functionalities from the main process to the renderer process.

## 2. Technology Stack

- **Electron**: Core framework for building the cross-platform desktop app.
  - **`electron-updater`**: Handles automatic application updates.
- **React**: Library for building the user interface.
- **TypeScript**: For static typing and improved code quality.
- **esbuild**: A very fast JavaScript/TypeScript bundler used for building the main, renderer, and preload scripts.
- **TailwindCSS**: A utility-first CSS framework for styling the application.
- **diff-match-patch**: Library used to compute and render the diff view for AI-assisted file modifications.

## 3. Project Structure

- `dist/`: The output directory for all bundled and copied files, which Electron runs.
- `electron/`: Contains code for the Electron-specific parts.
  - `main.ts`: The main process entry point.
  - `preload.ts`: The context bridge script.
- `src/` (aliased in `esbuild.config.js` to root): Contains all the React application source code.
  - `components/`: Reusable React components.
  - `services/`: Modules for handling business logic (API calls, logging, etc.).
  - `hooks/`: Reusable React hooks.
  - `types.ts`: TypeScript type definitions.
  - `constants.ts`: Application-wide constants.
  - `App.tsx`: The root React component, which manages global state.
  - `index.tsx`: The entry point for the React application.
- `esbuild.config.js`: The build script configuration.
- `package.json`: Project metadata and dependencies.

## 4. State Management

The application employs a simple, centralized state management model. The root `App.tsx` component holds all major application state (e.g., `config`, `models`, `sessions`, `currentView`) using React's `useState` hook. State and state-updating functions are passed down to child components as props. For global, cross-cutting concerns like notifications, React Context is used (e.g., `ToastProvider`). Care is taken to ensure correct provider nesting, as components like `ToastComponent` may depend on contexts from other providers (e.g., `TooltipProvider`).

## 5. Electron IPC (Inter-Process Communication)

The renderer process is sandboxed and cannot directly access Node.js APIs. Communication with the main process is handled via IPC:

- `electron/preload.ts` exposes a `window.electronAPI` object to the renderer.
- This API includes functions like `getSettings`, `saveSettings`, `runPython`, `projectGetFileTree`, `api:make-request`, `detect:toolchains`, `projectRunCommand`, `project:find-file`, `settings:export`, `settings:import`, `updates:check`, and `updates:install`.
- When a renderer function like `window.electronAPI.projectRunCommand({ projectPath, command })` is called, it sends an IPC message to the main process. The main process's handler for `project:run-command` executes the shell command within the specified project directory and returns the `stdout` and `stderr`.
- For asynchronous events like system stats or application updates, the main process sends messages to the renderer using `mainWindow.webContents.send()`. The preload script exposes listener functions (e.g., `onUpdateAvailable`, `onUpdateDownloading`, `onUpdateDownloaded`) that allow the renderer to subscribe to these events. Each listener has a corresponding `remove...Listener` function to ensure proper cleanup and prevent memory leaks.

## 6. Key Feature Implementation

### Custom Title Bar
The application utilizes Electron's frameless window feature to achieve a modern, integrated UI, similar to applications like VS Code.
1.  **Frameless Window**: In `electron/main.ts`, the `BrowserWindow` is created with the `frame: false` option. This removes the default OS-provided window frame (title bar, minimize/maximize/close buttons).
2.  **Custom React Component**: A dedicated React component, `TitleBar.tsx`, is rendered at the top of the `App` component. This component is responsible for drawing the entire custom title bar UI.
3.  **Draggable Region**: The main container of the `TitleBar` component has the CSS property `-webkit-app-region: drag;` applied. This tells Electron that this area should act as a draggable handle for the window.
4.  **Non-Draggable Elements**: All interactive elements within the title bar (navigation buttons, search box, window controls) have `-webkit-app-region: no-drag;` applied so that they remain clickable and don't trigger a window drag.
5.  **IPC for Window Controls**: The custom minimize, maximize, and close buttons in the `TitleBar` component are simple HTML buttons. Their `onClick` handlers call functions exposed on the `window.electronAPI` object (e.g., `minimizeWindow()`). These functions, defined in `electron/preload.ts`, send IPC messages (`window:minimize`, `window:maximize`, `window:close`) to the main process.
6.  **Main Process Handlers**: In `electron/main.ts`, `ipcMain.handle` listeners for these channels call the corresponding `BrowserWindow` methods (`mainWindow.minimize()`, etc.) to control the actual native window.
7.  **State Sync**: To correctly display the maximize/restore icon, the main process listens for the `maximize` and `unmaximize` events on the `BrowserWindow` instance. When these events fire, it sends a `window-state-changed` IPC message to the renderer, which updates its state and re-renders the correct icon.

### Application Updates
The update system uses the `electron-updater` library and a system of IPC events to provide a seamless user experience.
1.  **Main Process Logic (`electron/main.ts`)**:
    - On startup, `autoUpdater.checkForUpdates()` is called.
    - Event listeners are attached to `autoUpdater` for `update-available`, `update-downloaded`, `update-not-available`, and `error`. A special `update-downloading` event is synthesized on the first `download-progress` chunk for more granular feedback.
    - When these events fire, the main process sends an IPC message (e.g., `mainWindow.webContents.send('update-available', info)`) to the renderer process.
2.  **IPC Handlers**:
    - `updates:check`: An `ipcMain.handle` that allows the renderer to manually trigger `autoUpdater.checkForUpdates()`.
    - `updates:install`: An `ipcMain.handle` that calls `autoUpdater.quitAndInstall()` to restart the app and apply the update.
3.  **Renderer Logic (`App.tsx`)**:
    - The root `App` component uses a `useEffect` hook to register listeners for all the update-related IPC channels exposed by the preload script (e.g., `window.electronAPI.onUpdateAvailable`).
    - When an event is received, it uses the global `ToastProvider` to display a notification to the user (e.g., "New version found, downloading...").
    - The "Restart & Install" button in the `update-downloaded` toast is wired to call `window.electronAPI.quitAndInstallUpdate()`.

### Guaranteed JSON Mode
This feature improves the reliability of the API Client by instructing the model to return a structured JSON response.
- **Implementation**: The logic resides in `services/llmService.ts` within the `textCompletionOpenAI` and `textCompletionGemini` functions.
- **Mechanism**: When the `jsonMode` flag is `true` in the `generationConfig`:
  - For OpenAI-compatible endpoints (Ollama, LMStudio), the request payload includes `response_format: { type: 'json_object' }`.
  - For Google Gemini, the request configuration includes `responseMimeType: 'application/json'`.
- **UI**: The "Guaranteed JSON Mode" toggle in `components/ApiView.tsx` controls this flag.

### Tool Use / Function Calling
This transforms the chat into an agent. The entire workflow is orchestrated by the `processConversationTurn` and `handleToolApproval` functions in `App.tsx`.
1.  **Tool Definition**: A list of available `Tool` objects is defined in `App.tsx`. A global `executePython` tool is always available in the desktop app. Project-specific tools (`listFiles`, `readFile`, `writeFile`, `runTerminalCommand`) are added to the list only when a project is active and the "Project Agent" is enabled. These definitions are passed to the LLM service.
2.  **API Call**: `services/llmService.ts`'s `streamChatCompletion` function includes the `tools` array in the request to the LLM.
3.  **Response Parsing**: The service streams the response, watching for `tool_calls` chunks. It carefully assembles streamed JSON fragments into complete `ToolCall` objects.
4.  **Approval Flow**: Back in `App.tsx`, if the response contains tool calls, they are stored in the `pendingToolCalls` state, which triggers the `ToolCallApprovalModal`. The modal distinguishes between safe (read-only) and dangerous (write/execute) tools, requiring explicit user consent for the latter.
5.  **Tool Execution**: In `handleToolApproval`, the approved tool calls are executed. The `executeToolCall` function acts as a router, mapping the tool name to the corresponding `electronAPI` function (e.g., `listFiles` -> `window.electronAPI.projectListFilesRecursive`). These functions are implemented in `electron/main.ts` and perform the actual system operations.
6.  **Sending Results**: The output from each tool is formatted into a `ToolResponseMessage`.
7.  **Final Response**: The original conversation history, plus the assistant's `tool_calls` message, and the new `ToolResponseMessage` messages are sent back to the LLM in a new call to `processConversationTurn`. The model uses the tool results to formulate its final, synthesized answer to the user.

### AI-Assisted File Modification
This workflow is an integrated part of the **Tool Use / Function Calling** system.
1.  **User Request**: The user asks the AI to modify a file (e.g., "refactor `utils.py` to be more efficient").
2.  **Tool Selection**: The AI determines that the `writeFile` tool is the most appropriate action. It may first use the `readFile` tool to get the current content.
3.  **Content Generation**: The AI generates the new, modified content for the file.
4.  **Tool Call**: The AI issues a `writeFile` tool call with the file path and the new content as arguments.
5.  **Approval & Diffing**: The tool call is intercepted by the application's security approval flow. Because `writeFile` is a "dangerous" operation, the user is presented with a modal. For this specific tool, the application automatically fetches the original content of the file and presents a color-coded, line-by-line diff view directly within the tool call panel in the chat, showing exactly what will change.
6.  **Action Handling**: The user can approve or deny the action. If approved, the main process executes the `writeFile` IPC call, overwriting the file on disk. The result is then sent back to the model, which confirms the action to the user.

### Chat Performance Optimization
The chat view faced a performance degradation issue in long conversations, where input latency increased significantly. This was caused by the re-rendering of the entire message list on every keystroke in the input box. The issue was resolved by memoizing the individual chat message component (`MemoizedChatMessage` using `React.memo`). This ensures that only the message components whose props have changed (e.g., the last message being streamed) are re-rendered, while the rest of the conversation history is not, leading to a consistently smooth user experience regardless of conversation length.

### Services Deep Dive

- **`llmService.ts`**: Handles all communication with the LLM server.
  - `fetchModels`: Sends a GET request to the `/models` endpoint.
  - `streamChatCompletion`: Sends a POST request to `/chat/completions` with `stream: true`. It uses the Fetch API's `ReadableStream` to process chunks of data as they arrive, providing a real-time chat experience.
  - `generateTextCompletion`: A non-streaming version used for internal tasks like API client generation.
- **`logger.ts`**: Implemented as a singleton class. It maintains an in-memory array of log entries and uses a subscriber pattern to notify components (like the `LoggingPanel`) of new logs.

## 7. Build Process

The `esbuild.config.js` script handles the entire build process:
1.  Cleans the `dist/` directory.
2.  Copies static assets (`index.html`, Pyodide files, and documentation) to `dist/`.
3.  Bundles and transpiles the TypeScript code for the main, preload, and renderer processes into JavaScript files in `dist/`.
4.  When preparing a release, run `npm run build` followed by `npm run publish` to let `electron-builder` generate installers and upload them to the configured GitHub repository.

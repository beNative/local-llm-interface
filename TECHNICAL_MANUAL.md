# Technical Manual

This document describes the technical architecture of the Local LLM Interface application.

## 1. High-Level Architecture

The application is an [Electron](https://www.electronjs.org/) application that wraps a [React](https://reactjs.org/) single-page application (SPA). This allows for a rich, modern user interface built with web technologies, while also granting the low-level system access of a desktop application (e.g., for file I/O and running native processes).

- **Main Process**: The Electron main process (`electron/main.ts`) is the backend of the application. It manages the application lifecycle, creates the browser window, and handles all interactions with the operating system.
- **Renderer Process**: The React application (`index.tsx` and all component files) runs in the Electron browser window. It is responsible for the entire user interface and user experience. It cannot directly access Node.js or OS-level APIs.
- **Preload Script**: The preload script (`electron/preload.ts`) is a bridge between the renderer and main processes. It uses Electron's `contextBridge` to securely expose specific Node.js/Electron functionalities from the main process to the renderer process.

## 2. Technology Stack

- **Electron**: Core framework for building the cross-platform desktop app.
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
  - `types.ts`: TypeScript type definitions.
  - `constants.ts`: Application-wide constants.
  - `App.tsx`: The root React component, which manages global state.
  - `index.tsx`: The entry point for the React application.
- `esbuild.config.js`: The build script configuration.
- `package.json`: Project metadata and dependencies.

## 4. State Management

The application employs a simple, centralized state management model. The root `App.tsx` component holds all major application state (e.g., `config`, `models`, `sessions`, `currentView`) using React's `useState` hook. State and state-updating functions are passed down to child components as props.

## 5. Electron IPC (Inter-Process Communication)

The renderer process is sandboxed and cannot directly access Node.js APIs. Communication with the main process is handled via IPC:

- `electron/preload.ts` exposes a `window.electronAPI` object to the renderer.
- This API includes functions like `getSettings`, `saveSettings`, `runPython`, `projectGetFileTree`, `api:make-request`, `detect:toolchains`, and `project:find-file`.
- When a renderer function like `window.electronAPI.projectGetFileTree(path)` is called, it sends an IPC message to the main process. The main process's handler for `project:get-file-tree` recursively scans the project directory, generates a text-based file tree, and returns it.

## 6. Key Feature Implementation

### Retrieval-Augmented Generation (RAG)
The "Smart Context" feature is a RAG pipeline implemented in `App.tsx`. It consists of a two-step LLM call process:
1.  **Retrieval Step**: A pre-flight request is made to the LLM. The prompt includes the user's query and the project's file tree (obtained via IPC). The LLM is instructed to act as a "retrieval expert" and return a JSON array of the most relevant file paths.
2.  **Generation Step**: The application reads the content of the files identified in the retrieval step (using IPC calls to `project:read-file`). This content is concatenated and injected into a new, augmented system prompt. The final request, containing the original user query and the retrieved file content, is then sent to the LLM to generate the answer.

### AI-Assisted File Modification
This workflow is also managed in `App.tsx`:
1.  **Intent Detection**: A regular expression (`modificationRegex`) is run against the user's message to detect keywords (e.g., "refactor", "modify") and a filename.
2.  **Context Building**: If a match is found, the app reads the current content of the specified file via an IPC call.
3.  **Specialized Prompt**: A special system prompt is constructed, instructing the AI to act as a code assistant and return only the new, complete file content, without any explanatory text. The original file content is included in this prompt.
4.  **Diff Rendering**: The AI's response (the new file content) is passed to the `FileModificationView.tsx` component. This component fetches the original file content again and uses the `diff-match-patch` library to compute and render a color-coded, line-by-line diff, which is presented to the user for review.
5.  **Action Handling**: The user's "Accept" or "Reject" action updates the chat message's state and, if accepted, uses an IPC call (`project:write-file`) to save the new content to disk.

### Services Deep Dive

- **`llmService.ts`**: Handles all communication with the LLM server.
  - `fetchModels`: Sends a GET request to the `/models` endpoint.
  - `streamChatCompletion`: Sends a POST request to `/chat/completions` with `stream: true`. It uses the Fetch API's `ReadableStream` to process chunks of data as they arrive, providing a real-time chat experience.
  - `generateTextCompletion`: A non-streaming version used for internal tasks like RAG retrieval and API client generation.
- **`logger.ts`**: Implemented as a singleton class. It maintains an in-memory array of log entries and uses a subscriber pattern to notify components (like the `LoggingPanel`) of new logs.

## 7. Build Process

The `esbuild.config.js` script handles the entire build process:
1.  Cleans the `dist/` directory.
2.  Copies static assets (`index.html`, Pyodide files, and documentation) to `dist/`.
3.  Bundles and transpiles the TypeScript code for the main, preload, and renderer processes into JavaScript files in `dist/`.
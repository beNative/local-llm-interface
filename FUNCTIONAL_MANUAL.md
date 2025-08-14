
# Functional Manual

This document provides a detailed guide on how to use the Local LLM Interface application.

## 1. Main Interface

The application window is composed of a header, a main content area, and an optional logging panel.

### Header Bar

The header is always visible and contains the primary navigation and control elements:

- **App Name**: Displays "Local LLM Interface".
- **Navigation Tabs**: Switch between the main application views: "Chat", "Projects", "Settings", and "Info".
- **Logs Button**: (File icon) Toggles the visibility of the logging panel at the bottom of the screen.
- **Theme Switcher**: (Sun/Moon icon) Toggles between light and dark mode instantly.

## 2. Settings Panel

The "Settings" tab allows you to configure how the app connects to your local LLM service.

- **LLM Provider**: A dropdown to quickly select a pre-configured profile.
  - **Ollama**: Defaults to `http://localhost:11434/v1`.
  - **LMStudio**: Defaults to `http://127.0.0.1:1234/v1`.
  - **Custom**: For any other OpenAI-compatible endpoint.
- **Base URL**: The full URL for the API endpoint (e.g., of your self-hosted model). This must be an OpenAI v1-compatible endpoint.
- **Automatically save logs to file**: (Electron app only) When checked, all logs are appended to a file named `local-llm-interface-YYYY-MM-DD.log` in the application's directory. This is useful for debugging.

Click **Save & Refresh Connection** to apply changes. The app will attempt to reconnect and fetch the model list.

## 3. Projects View

The "Projects" tab is a powerful feature for managing local code projects and integrating them with the LLM. This is only available in the desktop application.

### Project Types
- **Python**: For running backend scripts. The application will automatically manage a dedicated `venv` virtual environment for each project.
- **Node.js**: A versatile project type for server-side applications or web experiments. It supports JavaScript and TypeScript. When you run a Node.js project, the app will look for an entry point in this order:
  1. An `npm start` script in your `package.json`.
  2. Common script files like `index.ts` or `index.js`. (Note: To run TypeScript files, you must install `typescript` and `ts-node` as project dependencies).
  3. An `index.html` file, which will be opened in your browser as a fallback.
- **Web App**: A simple project type for static websites. Use this if your project's main entry point is a single `index.html` file and you don't need a Node.js backend.

### Managing Projects
- **Base Directory**: For each project type (Python, Node.js, Web App), you must first choose a "base directory" where all your projects of that type will be stored.
- **Creating Projects**: Once a base directory is set, you can create new projects. The application will create the necessary folder and boilerplate files.
- **Project Actions**: Each project appears as a card with several actions:
  - **Install Deps**: (Python/Node.js) Installs dependencies from `requirements.txt` or `package.json`.
  - **Open in Browser**: (Web App) Opens the project's `index.html` in your default web browser.
  - **Open Folder**: Opens the project's folder in your system's file explorer.
  - **Delete**: Permanently deletes the project folder and all its contents.

### Project File Viewer & Editor

- **Expand Project**: Click the project name on a card to expand it and reveal an interactive file tree.
- **Browse Files**: You can navigate the project's entire directory structure.
- **Edit Files**: Click on any file in the tree to open it in a built-in code editor. You can make changes and save them directly back to the file.

## 4. Model Selection

In the "Chat" tab, if no model is selected, you will see a grid of all available models from your LLM service.

- Each card shows the model's name and creation date.
- Click the **"Chat with this model"** button on a card to start a conversation.

## 5. Chat View

The chat view is where you interact with the selected LLM.

### Code Execution & Management

- **Run Button**: Code blocks for Python or Node.js will have a "Run" button.
  - **Execution Environment**: In the desktop app, you can choose to run code as a "Standalone" script or within the context of one of your created projects.
  - **Output**: The output (`stdout` and `stderr`) from the code execution will be displayed directly below the code block.
- **Save to Project Button**: Click the "Save" button on a code block (Python, Node.js, or HTML) to save it to one of your projects.
  - A dialog will appear where you can select the target project.
  - You can either type a new filename or select an existing file from a dropdown to overwrite it.

## 6. Logging Panel

Click the file icon in the header to toggle the logging panel at the bottom. This panel is invaluable for debugging connection issues or unexpected behavior.

- **Filters**: Click the `DEBUG`, `INFO`, `WARNING`, or `ERROR` buttons to toggle visibility for each log level.
- **Resizable**: You can click and drag the top edge of the panel to resize it.
- **Copy Logs**: Copies the entire log history to your clipboard.
- **Clear Logs**: Clears all logs from the panel.
- **Close**: Hides the logging panel.

# Functional Manual

This document provides a detailed guide on how to use the Local LLM Interface application.

## 1. Main Interface

The application window is composed of a header, a main content area, and an optional logging panel.

### Header Bar

The header is always visible and contains the primary navigation and control elements:

- **App Name**: Displays "Local LLM Interface".
- **Settings Button**: (Provider icon, e.g., Ollama) Opens the settings panel to configure the LLM provider.
- **Info Button**: (Info icon) Opens this documentation view.
- **Logs Button**: (File icon) Toggles the visibility of the logging panel at the bottom of the screen.
- **Theme Switcher**: (Sun/Moon icon) Toggles between light and dark mode instantly.

## 2. Settings Panel

Clicking the provider button in the header opens the Settings modal. Here you can configure how the app connects to your local LLM service.

- **LLM Provider**: A dropdown to quickly select a pre-configured profile.
  - **Ollama**: Defaults to `http://localhost:11434/v1`.
  - **LMStudio**: Defaults to `http://127.0.0.1:1234/v1`.
  - **Custom**: For any other OpenAI-compatible endpoint.
- **Base URL**: The full URL for the API endpoint (e.g., of your self-hosted model). This must be an OpenAI v1-compatible endpoint.
- **Automatically save logs to file**: (Electron app only) When checked, all logs are appended to a file named `local-llm-interface-YYYY-MM-DD.log` in the application's directory. This is useful for debugging.

Click **Save & Refresh** to apply changes. The app will attempt to reconnect and fetch the model list.

## 3. Model Selection

After successful configuration, the main view will display a grid of all available models from your LLM service.

- Each card shows the model's name and creation date.
- If the app cannot connect, an error message with diagnostic information will be shown.
- If the connection is successful but no models are found, a message will guide you to add models in your LLM service (e.g., `ollama pull <model_name>`).
- Click the **"Chat with this model"** button on a card to start a conversation.

## 4. Chat View

The chat view is where you interact with the selected LLM.

- **Header**: Shows the name of the current model and a button to go back to the model selection screen.
- **Message History**: Displays the conversation. User messages are on the right, and assistant messages are on the left.
- **Input Box**: Type your message and press Enter or click the Send button.
- **Markdown Rendering**: The assistant's responses are rendered as Markdown, supporting lists, tables, formatted text, and more.

### Code Execution

The chat interface can execute Python code blocks.

- **Run Button**: Python code blocks will have a "Run" button.
- **Execution Environment**:
  - In the **Electron app**, the code runs in your system's native Python environment, allowing it to interact with files and packages you have installed.
  - In a **web browser**, the code runs in a sandboxed WebAssembly environment (Pyodide). It cannot access local files or pre-installed packages.
- **Output**: The standard output (`stdout`) and standard error (`stderr`) from the code execution will be displayed in a box directly below the code block.

## 5. Logging Panel

Click the file icon in the header to toggle the logging panel at the bottom. This panel is invaluable for debugging connection issues or unexpected behavior.

- **Filters**: Click the `DEBUG`, `INFO`, `WARNING`, or `ERROR` buttons to toggle visibility for each log level.
- **Copy Logs**: Copies the entire log history to your clipboard.
- **Clear Logs**: Clears all logs from the panel.
- **Close**: Hides the logging panel.

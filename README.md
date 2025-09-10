# Local LLM Interface

A user-friendly desktop application to chat with locally installed LLMs serviced through Ollama, LMStudio, or any other OpenAI-compatible API endpoint.

## Features

- **Multiple Provider Support**: Connect to Ollama, LMStudio, or a custom OpenAI-compatible server.
- **Model Discovery**: Automatically fetches and displays a list of available models from the connected service.
- **Detailed Model Info**: View technical details for Ollama models, including file size, family, parameter count, and the full `Modelfile` content, before starting a chat.
- **Polished Chat Interface**: A clean, modern chat view for interacting with your chosen model.
- **Integrated Python Interpreter**: Execute Python code snippets directly from the chat and see the output.
- **Agentic Tool Use (Function Calling)**: Transform the AI into an active agent that can browse project files, read/write content, and execute terminal commands to fulfill complex requests.
- **Secure by Design**: Any potentially dangerous AI action (writing files, running commands, executing code) requires explicit user approval via an interactive modal before it can be executed.
- **AI-Assisted File Modifications**: Ask the AI to refactor or modify project files directly from the chat. Review the proposed changes in an interactive diff view and apply them with a single click.
- **Versatile API Client**: A dedicated view to generate, edit, and send HTTP requests using natural language prompts, perfect for testing APIs.
- **Guaranteed JSON Output**: An optional mode in the API client that instructs compatible models to return valid, structured JSON, dramatically improving reliability.
- **Advanced Project Management**: Full support for Python (venv), Node.js (npm), Java (Maven), Delphi, and static Web App projects.
- **In-App File Editor**: A built-in file viewer and editor to browse and modify your project files without leaving the application.
- **Code Execution**: Run Python/Node.js code snippets or entire projects directly from the interface.
- **System Prompts (Personas)**: Create and switch between different AI personas (e.g., "Senior DevOps Engineer") to tailor responses for specific tasks.
- **Command Palette**: A Spotlight-style interface (`Cmd/Ctrl+K`) to instantly search and navigate to chats, projects, files, and application views.
- **Multimodal Chat**: Attach images to your prompts for models that support it.
- **Advanced Customization**: Customize chat colors, font family, font size, and icon sets in the Settings panel.
- **Configurable UI Scale and Density**: Adjust the application's zoom level and the spacing of controls (Compact, Normal, Comfortable) for a personalized viewing experience.
- **Toolchain Detection**: Automatically detects installed development toolchains (Python, Java, Node.js, Delphi) and allows you to select which one to use.
- **System-Wide Status Bar**: Displays real-time system-wide CPU, GPU, and Memory usage for performance monitoring.
- **Advanced Logging**: A dockable, filterable logging panel shows all internal application events for easy debugging.
- **Persistent Settings**: Remembers your connection settings, projects, and theme preference between sessions.
- **Standard Installation Behavior**: Adheres to OS standards by storing settings and logs in the user's application data directory for better system integration.
- **Pre-release Updates**: Opt-in to receive pre-release versions for early access to new features.
- **About Dialog**: An in-app dialog provides version, credits, and copyright information.
- **Light & Dark Themes**: Switch between themes to suit your preference.

## Tech Stack

- **Framework**: Electron
- **Frontend**: React with TypeScript
- **Bundler**: esbuild
- **Styling**: TailwindCSS
- **Python in Browser**: Pyodide

## Getting Started

### Running in Development

1.  **Prerequisites**: Node.js and npm installed.
2.  Clone the repository: `git clone <repository_url>`
3.  Install dependencies: `npm install`
4.  Build the application: `npm run build`
5.  Run the app: `npm start`

### Packaged Application

To create a distributable executable, run:
`npm run package`

The output will be in the `release/` directory. The installer will place all necessary files, including this documentation, into the installation directory.
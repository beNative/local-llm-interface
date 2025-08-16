# Local LLM Interface

A user-friendly desktop application to chat with locally installed LLMs serviced through Ollama, LMStudio, or any other OpenAI-compatible API endpoint.

## Features

- **Multiple Provider Support**: Connect to Ollama, LMStudio, or a custom OpenAI-compatible server.
- **Model Discovery**: Automatically fetches and displays a list of available models from the connected service.
- **Detailed Model Info**: View technical details for Ollama models, including context window size and Modelfile content, before starting a chat.
- **Intuitive Chat Interface**: A clean, modern chat view for interacting with your chosen model.
- **Model Parameter Tuning**: Fine-tune model responses with adjustable parameters like Temperature, Top-K, and Top-P, right from the chat interface.
- **AI-Assisted File Modifications**: Ask the AI to refactor or modify project files directly from the chat. Review the proposed changes in an interactive diff view and apply them with a single click.
- **Smart Context (RAG)**: When a project is selected, the AI can automatically identify and read the most relevant files to answer your query, providing highly accurate, context-aware responses.
- **API Client**: A dedicated view to generate, edit, and send HTTP requests using natural language prompts, perfect for testing APIs.
- **Advanced Project Management**: Full support for Python (venv), Node.js (npm), Java (Maven), Delphi, and static Web App projects.
- **In-App File Editor**: A built-in file viewer and editor to browse and modify your project files without leaving the application.
- **Code Execution**: Run Python/Node.js code snippets or entire projects directly from the interface.
- **System Prompts (Personas)**: Create and switch between different AI personas (e.g., "Senior DevOps Engineer") to tailor responses for specific tasks.
- **Command Palette**: A Spotlight-style interface (`Cmd/Ctrl+K`) to instantly search and navigate to chats, projects, files, and application views.
- **Multimodal Chat**: Attach images to your prompts for models that support it.
- **Advanced Customization**: Customize chat colors, font family, and font size in the Settings panel.
- **Toolchain Detection**: Automatically detects installed development toolchains (Python, Java, Node.js, Delphi) and allows you to select which one to use.
- **Status Bar**: Displays real-time application CPU and Memory usage for performance monitoring.
- **Advanced Logging**: A dockable, filterable logging panel shows all internal application events for easy debugging.
- **Persistent Settings**: Remembers your connection settings, projects, and theme preference between sessions.
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
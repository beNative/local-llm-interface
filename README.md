# Local LLM Interface

A user-friendly desktop application to chat with locally installed LLMs serviced through Ollama, LMStudio, or any other OpenAI-compatible API endpoint.

## Features

- **Multiple Provider Support**: Connect to Ollama, LMStudio, or a custom OpenAI-compatible server.
- **Model Discovery**: Automatically fetches and displays a list of available models from the connected service.
- **Intuitive Chat Interface**: A clean, modern chat view for interacting with your chosen model.
- **Multimodal Chat**: Attach images to your prompts for models that support it.
- **Markdown & Syntax Highlighting**: Renders model responses in Markdown, with beautiful syntax highlighting for code snippets.
- **Code Execution**: Run Python code directly from the chat interface.
  - **Native Execution**: Uses your system's Python interpreter for full capability in the Electron app.
  - **WASM Fallback**: Uses Pyodide (Python in WebAssembly) for safe, in-browser execution as a fallback.
- **Resizable Interface**: Adjust the width of the session sidebar for a custom layout.
- **Enhanced Chat Controls**: Includes a "Stop Generation" button and an auto-resizing text input.
- **Smart Session Management**: Automatically generate session titles based on conversation content, with a manual trigger button.
- **Advanced Logging**: A dockable logging panel shows all internal application events, with filtering by severity level (DEBUG, INFO, WARNING, ERROR).
- **File Logging**: Option to automatically save logs to a file for easier debugging.
- **Persistent Settings**: Remembers your connection settings and theme preference between sessions.
- **Light & Dark Themes**: Switch between themes to suit your preference.
- **Cross-Platform**: Built with Electron to run on Windows, macOS, and Linux.

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
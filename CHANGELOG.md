# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - YYYY-MM-DD

### Added
- **Project Context Awareness**: In the Chat view, you can now select an active project from a dropdown menu. When a project is selected, its entire file tree is automatically sent to the LLM as context with your prompt. This enables more intelligent, project-aware questions like "Where is the database logic?" or "Refactor the `ProductCard` component."

## [1.1.0] - YYYY-MM-DD

### Added
- **In-App Documentation Viewer**: A new "Info" tab in the header opens a view to read application documentation directly.
- **Documentation Files**: Added `README.md`, `FUNCTIONAL_MANUAL.md`, `TECHNICAL_MANUAL.md`, and this `CHANGELOG.md`.
- **Packaging**: The build process now includes all documentation files in the packaged application, making them available offline.

## [1.0.0] - YYYY-MM-DD

### Initial Release

- **LLM Connectivity**: Connect to Ollama, LMStudio, and other OpenAI-compatible APIs.
- **Model Selection**: View and select from a list of available LLM models.
- **Chat Interface**: Real-time, streaming chat with conversation history.
- **Markdown Rendering**: Responses are rendered as Markdown with syntax highlighting for code.
- **Python Code Execution**: Run Python code blocks from the chat interface (native via Electron, WASM via Pyodide in browser).
- **Logging System**: A toggleable logging panel with level filtering, copy-to-clipboard, and clear functionality.
- **File Logging**: Option to save logs to a file in the Electron app for debugging.
- **UI Features**: Light and Dark theme support.
- **Persistence**: Settings are saved between sessions (to a file in Electron, localStorage in browser).
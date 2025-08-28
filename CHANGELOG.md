# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2024-06-15

### Added
- **Drag & Drop File Import**: Users can now drag files from their operating system and drop them directly onto a folder in the Project view's file tree. A confirmation dialog appears before the file is copied into the project.

## [1.5.0] - 2024-06-01

### Added
- **Model Parameter Tuning**: A new "Parameters" popover in the chat header allows for adjusting Temperature, Top-K, and Top-P for the current session.
- **Detailed Model Info**: An "Info" icon on Ollama model cards in the selection screen opens a modal with technical details, including context window size and the full Modelfile.

### Changed
- **Improved Session List**: The sidebar now displays the model used for each conversation under the session title for better clarity.

### Fixed
- **Chat Input Performance**: Resolved a major performance issue where the chat input box would become very slow in long conversations by memoizing message components.

## [1.4.0] - 2024-05-20

### Added
- **AI-Assisted File Modifications**: Empower the AI to propose changes directly to project files. Users can review these changes in an interactive diff view and accept or reject them with a single click.
- **Smart Context (RAG)**: A new "Smart Context" toggle for project-based chats. When enabled, the AI first identifies the most relevant project files for a query, reads their content, and then generates a highly context-aware response.
- **API Client View**: A new major feature that allows users to generate, edit, and send HTTP requests using natural language prompts. It's a powerful tool for testing and interacting with APIs.
- **System Prompts (Personas)**: Users can now create, save, and switch between different system prompts (personas) for the AI, allowing for specialized behavior in each chat session.
- **Appearance Customization**: Added extensive theme customization options in Settings, including the ability to change chat colors, font family, and font size.
- **Command Palette**: A powerful `Cmd/Ctrl+K` command palette has been added for fast navigation. Users can search for and jump to any chat session, project, project file, or application view.
- **Advanced Project Support**: Added full project management support for **Java (Maven)** and **Delphi**, including creation, building, and running.
- **Toolchain Detection**: The application now automatically detects installed development toolchains (Python, JDK, Node.js, Delphi) and allows users to select a specific version in Settings.
- **Status Bar**: A new status bar at the bottom of the window displays real-time application CPU and Memory usage (Electron app only).

## [1.3.0] - 2024-05-10

### Added
- **Resizable Sidebar**: The session list sidebar can now be resized by dragging its edge, allowing for more flexible layout customization.
- **Multimodal Chat**: Added support for attaching images to chat messages for local models that support multimodal inputs (e.g., LLaVA).
- **"Stop Generation" Button**: A button now appears during model response generation to allow users to interrupt the stream.
- **Auto-resizing Chat Input**: The text input area for chat messages now automatically grows in height as you type.
- **Auto-generate Session Name Button**: A new icon button next to each session allows for manually triggering the automatic naming feature.

### Changed
- **Improved Error States**: The "Model Selection" view now includes a "Go to Settings" button when a connection fails or no models are found, improving user guidance.

### Fixed
- **Session Renaming**: Fixed an issue where the smart session renaming feature was not working correctly due to an incorrect API call.

## [1.2.0] - 2024-05-01

### Added
- **Project Context Awareness**: In the Chat view, you can now select an active project from a dropdown menu. When a project is selected, its entire file tree is automatically sent to the LLM as context with your prompt. This enables more intelligent, project-aware questions like "Where is the database logic?" or "Refactor the `ProductCard` component."

## [1.1.0] - 2024-04-25

### Added
- **In-App Documentation Viewer**: A new "Info" tab in the header opens a view to read application documentation directly.
- **Documentation Files**: Added `README.md`, `FUNCTIONAL_MANUAL.md`, `TECHNICAL_MANUAL.md`, and this `CHANGELOG.md`.
- **Packaging**: The build process now includes all documentation files in the packaged application, making them available offline.

## [1.0.0] - 2024-04-15

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
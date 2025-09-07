# Changelog

All notable changes to this project will be documented in this file.

## [0.15.0] - 2025-09-23

### Added
- **About Dialog**: Added an "About" dialog accessible from the Info view, displaying application credits, version, and copyright information.

### Fixed
- **React Hooks**: Resolved a critical React error ("Rendered more hooks than during the previous render") in the Chat view's persona selector by refactoring the list item into its own component. This ensures hooks are called consistently, improving stability.

## [0.14.0] - 2025-09-22

### Added
- **Application Scale**: Added a setting in "Settings > Personalization" to adjust the application's overall zoom level, improving accessibility and readability on different displays.
- **Control Density**: Added a "Control Density" setting with "Compact", "Normal", and "Comfortable" options to adjust the spacing and padding of UI elements for a customized user experience.

## [0.13.0] - 2025-09-16

### Added
- **Pre-release Updates**: Added a setting in "Settings > General > Updates" to allow users to opt-in to receiving pre-release versions of the application from GitHub.

## [0.12.1] - 2025-09-15

### Changed
- **UI Refinement**: Removed the main "Local LLM Interface" title from the header bar for a cleaner, more minimalist appearance. The primary navigation is now the main focus.

## [0.12.0] - 2025-09-14

### Changed
- **Standard Installation Behavior**: The application now adheres to operating system standards by storing all configuration and log files in the user's application data directory (`%APPDATA%` on Windows, `~/Library/Application Support` on macOS, `~/.config` on Linux). This changes the application from a "portable" app to a standard installed application, improving system integration and security.

## [0.11.0] - 2025-09-07

### Fixed
- **Gemini API Integration**: Correctly implemented response and stream chunk handling by accessing the `.text` property directly, resolving issues with empty or malformed responses from the Gemini API.
- **Multimodal Chat**: Fixed a typo in the `FileReader` API (`readAsDataURL` instead of `readDataURL`) that prevented image attachments from working.
- **Session Naming**: Improved the reliability of automatic session name generation by safely handling complex message types (like images) when creating the summary prompt.
- **Tooltip Stability**: Resolved several issues in the tooltip system, including incorrect `setTimeout` usage and potential memory leaks, to improve stability.
- **Tool Execution**: Enhanced the tool approval workflow to correctly handle messages with mixed content types (text and images).

## [0.10.0] 

### Added
- **Ollama Model Details**: The model details modal for Ollama models now fetches and displays the model's file size, family, parameter count, Modelfile content, parameters, and template.

### Changed
- The sections within the model details modal are now scrollable to better handle long content.

## [0.9.0] 

### Added
- **Agentic Tool Use / Function Calling**: Transformed the chat into a true agent. When a project context is active, the AI can now use tools to interact with the file system and run terminal commands (`listFiles`, `readFile`, `writeFile`, `runTerminalCommand`).
- **Interactive Tool Dashboard**: A new UI appears in the chat when the AI uses tools, showing the exact commands and parameters.
- **Security Approval Flow**: For any dangerous actions (writing files, running commands), a modal now appears requiring explicit user approval before the AI can proceed.
- **Guaranteed JSON Mode**: Added a "Guaranteed JSON Mode" toggle to the API Client. This instructs compatible models (Ollama, LMStudio, Gemini) to return valid, structured JSON, dramatically improving the reliability of the "Generate Request" feature.

### Changed
- Updated all documentation files (README, Manuals) to reflect the new agentic capabilities and JSON mode.

## [0.8.0] 

### Changed
- **UI/UX Overhaul**: Performed a comprehensive visual polish across the entire application. All views, components, and controls have been refined for a cleaner, more modern, and more intuitive user experience. This includes improved component styling, consistent spacing and shadows, and more responsive visual feedback on interactions.
- **Code Refinement**: Conducted a general cleanup across the codebase to improve readability and ensure best practices are followed.
- **Documentation Sync**: Updated the functional manual, README, and changelog to accurately reflect the polished interface and its features.

## [0.7.0] 

### Improved
- **Chat**: Code blocks now feature automatic language detection, ensuring more reliable syntax highlighting and enabling contextual actions (like "Run" or "Save") even when the language is not specified in the markdown.

### Fixed
- **API Client**: Fixed critical JSON parsing errors that occurred when the LLM returned request headers as an object instead of an array, or when the request body contained unescaped characters. The client is now significantly more robust against variations in model output.

## [0.6.0] 

### Added
- **Drag & Drop File Import**: Users can now drag files from their operating system and drop them directly onto a folder in the Project view's file tree. A confirmation dialog appears before the file is copied into the project.

## [0.5.0] 

### Added
- **Model Parameter Tuning**: A new "Parameters" popover in the chat header allows for adjusting Temperature, Top-K, and Top-P for the current session.
- **Detailed Model Info**: An "Info" icon on Ollama model cards in the selection screen opens a modal with technical details, including context window size and the full Modelfile.

### Changed
- **Improved Session List**: The sidebar now displays the model used for each conversation under the session title for better clarity.

### Fixed
- **Chat Input Performance**: Resolved a major performance issue where the chat input box would become very slow in long conversations by memoizing message components.

## [0.4.0] 

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

## [0.3.0] 

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

## [0.2.0] 

### Added
- **Project Context Awareness**: In the Chat view, you can now select an active project from a dropdown menu. When a project is selected, its entire file tree is automatically sent to the LLM as context with your prompt. This enables more intelligent, project-aware questions like "Where is the database logic?" or "Refactor the `ProductCard` component."

## [0.1.1] 

### Added
- **In-App Documentation Viewer**: A new "Info" tab in the header opens a view to read application documentation directly.
- **Documentation Files**: Added `README.md`, `FUNCTIONAL_MANUAL.md`, `TECHNICAL_MANUAL.md`, and this `CHANGELOG.md`.
- **Packaging**: The build process now includes all documentation files in the packaged application, making them available offline.

## [0.1.0] 

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
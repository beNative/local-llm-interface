# Functional Manual

This document provides a detailed guide on how to use the Local LLM Interface application.

## 1. Main Interface

The application window is composed of a header, a main content area, a status bar, and an optional logging panel.

### Header Bar

The header is always visible and contains the primary navigation and control elements:

- **App Name**: Displays "Local LLM Interface".
- **Navigation Tabs**: Switch between the main application views: "Chat", "Projects", "API Client", "Settings", and "Info".
- **Command Palette Shortcut**: A `Cmd/Ctrl + K` hint is displayed. Pressing this key combination opens the command palette for quick navigation.
- **Logs Button**: (File icon) Toggles the visibility of the logging panel at the bottom of the screen.
- **Theme Switcher**: (Sun/Moon icon) Toggles between light and dark mode instantly.

### Status Bar (Desktop App Only)

At the very bottom of the window, the status bar provides real-time feedback on the application's performance:
- **RAM Usage**: Shows how much memory the application is currently using compared to the system's total memory.
- **CPU Usage**: Shows the application's current CPU consumption.

## 2. Command Palette

Press `Cmd+K` or `Ctrl+K` to open the command palette. This is a powerful search interface that allows you to instantly:
- Navigate to any view (Chat, Projects, etc.).
- Switch to any of your past chat sessions.
- Open any file from any of your projects in the editor.

Just start typing to filter the list and press `Enter` to execute the selected command.

## 3. Settings Panel

The "Settings" tab allows you to configure every aspect of the application.

### Connection
- **LLM Provider**: A dropdown to quickly select a pre-configured profile (Ollama, LMStudio, Custom).
- **Base URL**: The full URL for the API endpoint.

### Predefined Prompts
- Create and manage a list of frequently used prompts that you can quickly insert into the chat input.

### System Prompts (Personas)
- Create and manage different "personas" for the AI. A persona is a detailed system prompt that instructs the AI on how to behave (e.g., "You are a senior DevOps engineer with 20 years of experience..."). You can switch between these personas in the Chat view.

### Appearance
- **Theme Tabs**: Configure colors separately for Light and Dark themes.
- **Color Customization**: Use a color picker to change the default colors for the chat background, user messages, and assistant messages.
- **Font Settings**: Change the global font family (Sans-serif, Serif, Monospace) and font size for the chat interface.

### Advanced (Desktop App Only)
- **Toolchains**: The app automatically detects installed development tools. You can select a specific Python interpreter, Java Development Kit (JDK), Node.js executable, or Delphi compiler to be used for creating and running projects. If none is selected, the system's default (from the PATH) will be used.
- **Logging**: Enable the "Automatically save logs to file" option to keep a persistent record of application activity for debugging.

## 4. Projects View

The "Projects" tab is a powerful feature for managing local code projects and integrating them with the LLM. This is only available in the desktop application.

### Project Types
- **Python**: For running backend scripts. The application will automatically manage a dedicated `venv` virtual environment for each project.
- **Node.js**: A versatile project type for server-side applications or web experiments. It supports JavaScript and TypeScript.
- **Java**: For creating and running Java applications managed with Maven.
- **Delphi**: For creating and building console applications with Object Pascal.
- **Web App**: A simple project type for static websites.

### Managing Projects
- **Base Directory**: For each project type, you must first choose a "base directory" where all your projects of that type will be stored.
- **Creating Projects**: Once a base directory is set, you can create new projects. The application will create the necessary folder and boilerplate files.
- **Project Actions**: Each project appears as a card with several actions:
  - **Install Deps**: Installs dependencies from `requirements.txt`, `package.json`, or `pom.xml`.
  - **Run Project**: Runs the project using its standard entry mechanism.
  - **Open Folder**: Opens the project's folder in your system's file explorer.
  - **Delete**: Permanently deletes the project folder and all its contents.

### Project File Viewer & Editor
- **Expand Project**: Click the project name on a card to expand it and reveal an interactive file tree.
- **Edit Files**: Click on any file in the tree to open it in a built-in code editor. You can make changes and save them directly back to the file.
- **Add to Chat**: From the editor, click "Add to Chat Context" to inject the file's content directly into the chat input, making it easy to ask questions about specific code.
- **Add Files via Drag and Drop**: You can add external files to your project by dragging them from your computer's file explorer and dropping them onto any folder in the file tree. When you hover over a valid folder, it will be highlighted. Upon dropping the files, a confirmation dialog will appear, listing the files to be added. Confirming will copy the files into that project folder.

## 5. API Client View (Desktop App Only)

The "API Client" is a new view designed for testing and interacting with HTTP APIs.
- **Natural Language Prompt**: Describe the request you want to make (e.g., "get all users from the jsonplaceholder api").
- **Generate Request**: The application uses the selected LLM to automatically generate the full HTTP request, including the correct method, URL, headers, and body.
- **Edit Request**: You can manually edit any part of the generated request before sending it.
- **Send & View Response**: Send the request and view the detailed response, including status code, headers, and a syntax-highlighted body.

## 6. Model Selection

When you start the app or create a new chat, you are presented with the Model Selection screen. This screen lists all models available from your configured LLM service.

- **Model Cards**: Each model is displayed on a card with available details like its family, parameter size, and quantization level.
- **Detailed Info (Ollama)**: For Ollama models, an **Info icon** is available on the card. Clicking this icon opens a modal displaying advanced technical details, including its context window size (`num_ctx`) and the full content of its `Modelfile`.
- **Start Chat**: Click on any model card to start a new chat session with it.

## 7. Chat View

The chat view is the primary interface for interacting with the LLM.

### Session Management
- **Resizable Sidebar**: Drag the vertical divider to adjust the sidebar width.
- **Session List**: All your conversations are listed here. Each entry now shows the session title and, in a smaller font, the model that was used for that conversation.
- **Session Actions**: Hover over a session to reveal buttons for automatically generating a name or deleting the session.

### Advanced Context Tools (Desktop App Only)

- **Project Context Selector**: A "Context" dropdown appears in the header. When you select a project, the AI becomes aware of its structure.
- **Smart Context (RAG)**: A toggle appears next to the project selector. When enabled, the chat enters a powerful Retrieval-Augmented Generation mode:
  1.  **Retrieval**: The AI first analyzes your prompt and the project's file list to determine which files are most relevant to your question. A "Finding relevant files..." status will appear.
  2.  **Generation**: The app reads the content of those files and injects it as context into the final prompt sent to the LLM.
  3.  **Transparency**: The AI's response will include a "Context from N files" dropdown, showing you exactly which files it chose to read.

### Personas
- A "Persona" dropdown in the header allows you to select one of your saved System Prompts. This will change the AI's behavior for the current chat session.

### Model Parameters
A "Parameters" dropdown in the header allows you to adjust generation parameters for the current chat session:
- **Temperature**: Controls the randomness of the output. Higher values (e.g., 1.2) make the output more creative, while lower values (e.g., 0.5) make it more deterministic.
- **Top-K**: Narrows the model's choices to the K most likely words at each step of generation.
- **Top-P**: (Nucleus Sampling) Narrows the model's choices to a cumulative probability mass. For example, a Top-P of 0.9 means the model only considers words that make up the top 90% of the probability distribution.
These settings are saved with the session.

### AI-Assisted File Modifications
- When you have a project selected as context, you can ask the AI to modify a file (e.g., "refactor `utils.py` to be more efficient").
- The AI will respond with a special **diff view** component.
- This view shows a line-by-line comparison of the original file and the AI's proposed changes.
- You can then **Accept** the changes, which will directly overwrite the file on your disk, or **Reject** them.

### Conversation & Controls
- **Message Input**: The text area automatically grows as you type.
- **Multimodal Chat**: Use the **paperclip icon** to attach an image.
- **Predefined Prompts**: Use the **bookmark icon** to quickly insert one of your saved prompts.
- **Stop Generation**: While the model is responding, a red "Stop" button appears, allowing you to interrupt it.
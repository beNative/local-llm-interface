# Functional Manual

This document provides a detailed guide on how to use the Local LLM Interface application.

## 1. Main Interface

The application window is composed of a header, a main content area, a status bar, and an optional logging panel.

### Header Bar

The header is always visible and contains the primary navigation and control elements:

- **App Name**: Displays "Local LLM Interface".
- **Navigation Bar**: A sleek, pill-shaped bar to switch between the main application views: "Chat", "Projects", "API Client", "Settings", and "Info". The active view is highlighted with a color accent.
- **Command Palette Shortcut**: A `Cmd/Ctrl + K` hint is displayed. Pressing this key combination opens the command palette for quick navigation.
- **Logs Button**: (File icon) Toggles the visibility of the logging panel at the bottom of the screen.
- **Theme Switcher**: (Sun/Moon icon) Toggles between light and dark mode instantly.

### Status Bar (Desktop App Only)

At the very bottom of the window, the status bar provides real-time feedback on the application's health and context:
- **Left Side (Context)**: Shows the current LLM provider (e.g., Ollama), connection status, active model, and active project context.
- **Right Side (Performance)**: Displays real-time, system-wide CPU, GPU, and Memory usage.

## 2. Command Palette

Press `Cmd+K` or `Ctrl+K` to open the command palette. This is a powerful search interface that allows you to instantly:
- Navigate to any view (Chat, Projects, etc.).
- Switch to any of your past chat sessions.
- Open any file from any of your projects in the editor.

Just start typing to filter the list and press `Enter` to execute the selected command.

## 3. Settings Panel

The "Settings" tab allows you to configure every aspect of the application. The view is organized with a clean navigation sidebar on the left and content cards on the right.

### General
- **Connection**: Select your LLM provider (Ollama, LMStudio, OpenAI, etc.). Add, edit, and delete custom OpenAI-compatible providers.
- **API Keys**: Securely enter and store API keys for providers that require them.
- **Logging**: Enable or disable saving logs to a file.

### Personalization
- **Appearance**: Configure colors separately for Light and Dark themes. Use a palette of predefined colors or input custom hex codes for the chat background, user messages, and assistant messages. Preview your changes in real-time.
- **Font Settings**: Change the global font family and font size for the chat interface.
- **Icon Set**: Choose from several included icon packs (Default, Lucide, Heroicons, etc.) to change the application's entire icon theme.

### Content
- **Predefined Prompts**: Create and manage a list of frequently used prompts that you can quickly insert into the chat input.
- **System Prompts (Personas)**: Create and manage different "personas" for the AI. A persona is a detailed system prompt that instructs the AI on how to behave (e.g., "You are a senior DevOps engineer with 20 years of experience..."). You can switch between these personas in the Chat view.

### Advanced (Desktop App Only)
- **Toolchains**: The app automatically detects installed development tools. You can select a specific Python interpreter, Java Development Kit (JDK), Node.js executable, or Delphi compiler to be used for creating and running projects. If none is selected, the system's default (from the PATH) will be used.

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
- **Project Cards**: Each project appears as a polished card with several actions:
  - **Run Project**: The primary action button, which runs the project using its standard entry mechanism.
  - **Install Deps**: Installs dependencies from `requirements.txt`, `package.json`, or `pom.xml`.
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
- **Guaranteed JSON Mode**: A toggle, enabled by default, that instructs compatible models to return a valid JSON object. This dramatically increases the reliability of request generation. Disable it only if your model doesn't support this feature.
- **Edit Request**: You can manually edit any part of the generated request before sending it. The UI is cleanly organized into Request and Response panels.
- **Send & View Response**: Send the request and view the detailed response, including status code, headers, and a syntax-highlighted body.

## 6. Model Selection

When you start the app or create a new chat, you are presented with the Model Selection screen. This screen lists all models available from your configured LLM service.

- **Model Cards**: Each model is displayed on a polished card with available details like its family, parameter size, and quantization level.
- **Detailed Info (Ollama)**: For Ollama models, an **Info icon** is available on the card. Clicking this icon opens a modal displaying advanced technical details, including its context window size (`num_ctx`) and the full content of its `Modelfile`.
- **Start Chat**: Click any model card to start a new chat session.

## 7. Chat View

The chat view is the primary interface for interacting with the LLM.

### Session Management
- **Resizable Sidebar**: Drag the vertical divider to adjust the sidebar width.
- **Session List**: All your conversations are listed here. Each entry now shows the session title and, in a smaller font, the model that was used for that conversation.
- **Session Actions**: Hover over a session to reveal buttons for automatically generating a name or deleting the session.

### Agentic Tool Use (Function Calling)
When a project is selected as your context, the chat transforms into a powerful agent capable of taking action on your behalf.
- **Available Tools**: The AI gains access to a set of tools to interact with your project:
  - `listFiles`: To browse the file structure.
  - `readFile`: To read the content of specific files.
  - `writeFile`: To create new files or modify existing ones.
  - `runTerminalCommand`: To execute shell commands like `npm install`.
- **How It Works**: You can ask for complex tasks like, "List all `.js` files in the `src` directory, then read `app.js` and tell me what it does."
- **Interactive Tool Dashboard**: When the AI decides to use tools, a new "Tool Call" panel appears in the chat. This panel transparently shows you:
  - Which tools the AI is calling.
  - The exact parameters for each call.
  - The results of the execution after it's complete.
- **Security First - Approval Required**: For any action that modifies your system (`writeFile`, `runTerminalCommand`), a modal will appear, pausing the AI. It lists the "dangerous" actions and requires your explicit approval for each one before it can proceed. Safe actions like reading files are approved automatically.

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
- **Intelligent Code Blocks**: Code blocks in responses are automatically syntax-highlighted. The application intelligently detects the programming language (e.g., Python, JavaScript, Java) even if not specified by the model, enabling relevant actions like "Run", "Save", and "Ask AI to Fix".
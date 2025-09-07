// This file contains shared type definitions used across the application.

// General Utility Types
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
export type Theme = 'light' | 'dark';
export type IconSet = 'default' | 'lucide' | 'heroicons' | 'feather' | 'fontawesome' | 'material';

// Configuration and Settings
export interface ColorOverrides {
  chatBg?: string;
  userMessageBg?: string;
  userMessageColor?: string;
  assistantMessageBg?: string;
  assistantMessageColor?: string;
}

export interface ThemeOverrides {
  light?: ColorOverrides;
  dark?: ColorOverrides;
  fontFamily?: string;
  fontSize?: number;
  iconSet?: IconSet;
}

export type LLMProviderType = 'openai-compatible' | 'google-gemini';

export interface LLMProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  type: LLMProviderType;
  apiKeyName?: string;
  isCustom: boolean;
}

export interface PredefinedPrompt {
  id: string;
  title: string;
  content: string;
}

export interface SystemPrompt {
  id: string;
  title: string;
  content: string;
}

export type ProjectType = 'python' | 'nodejs' | 'java' | 'delphi' | 'webapp';

export interface CodeProject {
  id:string;
  name: string;
  type: ProjectType;
  path: string;
}

export interface Config {
  providers: LLMProviderConfig[];
  selectedProviderId?: string;
  theme: Theme;
  themeOverrides?: ThemeOverrides;
  logToFile?: boolean;
  allowPrerelease?: boolean;
  pythonProjectsPath?: string;
  nodejsProjectsPath?: string;
  webAppsPath?: string;
  javaProjectsPath?: string;
  delphiProjectsPath?: string;
  projects?: CodeProject[];
  apiRecentPrompts?: string[];
  sessions?: ChatSession[];
  activeSessionId?: string;
  predefinedPrompts?: PredefinedPrompt[];
  systemPrompts?: SystemPrompt[];
  apiKeys?: Record<string, string>;
  selectedPythonPath?: string;
  selectedJavaPath?: string;
  selectedNodePath?: string;
  selectedDelphiPath?: string;
}

// Language Model and Chat Types
export interface ModelDetails {
  modelfile?: string;
  parameters?: string;
  template?: string;
  family?: string;
  parameter_size?: string;
  quantization?: string;
  context_length?: number;
}

export interface Model {
  id: string;
  name: string;
  object: string;
  created: number;
  owned_by: string;
  size?: number;
  details?: ModelDetails;
  isLoaded?: boolean;
}

// --- Tool Use / Function Calling Types ---
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object; // JSON Schema object
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name:string;
    arguments: string; // A JSON string of arguments
  };
  result?: any; // The result after execution
  approved?: boolean; // For UI state
}


// --- Chat Message Types ---
export interface ChatMessageContentPartText {
  type: 'text';
  text: string;
}

export interface ChatMessageContentPartImage {
  type: 'image_url';
  image_url: {
    url: string; // data URI
  };
}

export type ChatMessageContentPart = ChatMessageContentPartText | ChatMessageContentPartImage;

export interface ChatMessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatMessageMetadata {
  usage?: ChatMessageUsage;
  speed?: number; // tokens/sec
  thinking?: string;
  ragContext?: {
    files: string[];
  };
}

// A standard message from a user or assistant (text response)
export interface StandardChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatMessageContentPart[];
  metadata?: ChatMessageMetadata;
  tool_calls?: never;
  tool_call_id?: never;
}

// A message from the assistant requesting one or more tool calls
export interface AssistantToolCallMessage {
  role: 'assistant';
  content: string | null; // May contain text, but often null when calling tools
  tool_calls: ToolCall[];
  metadata?: ChatMessageMetadata;
  fileModification?: never;
  tool_call_id?: never;
}

// A message from the application providing the result of a tool call
export interface ToolResponseMessage {
  role: 'tool';
  tool_call_id: string;
  name: string;
  content: string; // The result of the tool, serialized as a string
  metadata?: never;
  fileModification?: never;
  tool_calls?: never;
}

export type ChatMessage = StandardChatMessage | AssistantToolCallMessage | ToolResponseMessage;


export interface GenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
  jsonMode?: boolean;
}

export interface ChatSession {
  id: string;
  name: string;
  modelId: string;
  providerId: string;
  messages: ChatMessage[];
  systemPromptId: string | null;
  generationConfig?: GenerationConfig;
  projectId: string | null;
  agentToolsEnabled?: boolean;
}

// File System and Project Types
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface Toolchain {
  path: string;
  version: string;
  name: string;
}

export interface ToolchainStatus {
  python: Toolchain[];
  java: Toolchain[];
  nodejs: Toolchain[];
  delphi: Toolchain[];
}

// API Client Types
export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ApiRequest {
  method: ApiHttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, any>;
  body: string;
}

// Electron-specific Types
export interface SystemStats {
  cpu: number;
  memory: {
    used: number;
    total: number;
  };
  gpu?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}
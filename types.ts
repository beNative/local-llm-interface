
export type Theme = 'light' | 'dark';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export type LLMProvider = 'Ollama' | 'LMStudio' | 'Custom';

export type ProjectType = 'python' | 'nodejs' | 'webapp';

export interface CodeProject {
  id: string;
  name: string;
  type: ProjectType;
  path: string; // Full path to the project directory
}

export interface FileSystemEntry {
  name: string;
  path: string; // Full path
  isDirectory: boolean;
  children?: FileSystemEntry[]; // For tree view state
}

export interface Config {
  provider: LLMProvider;
  baseUrl: string;
  theme?: Theme;
  logToFile?: boolean;
  pythonProjectsPath?: string;
  nodejsProjectsPath?: string;
  webAppsPath?: string;
  projects?: CodeProject[];
  pythonCommand?: string;
  apiRecentPrompts?: string[];
}

export interface Model {
  id: string;
  name: string; // Ollama uses 'name', OpenAI-compat uses 'id'
  object: string;
  created: number;
  owned_by: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

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
  headers: Record<string, string | string[] | undefined>;
  body: string;
}
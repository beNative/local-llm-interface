



export type Theme = 'light' | 'dark';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
export type IconSet = 'default' | 'lucide' | 'heroicons' | 'feather' | 'fontawesome' | 'material';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export type LLMProvider = 'Ollama' | 'LMStudio' | 'Custom';

export type ProjectType = 'python' | 'nodejs' | 'webapp' | 'java' | 'delphi';

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

export interface ColorOverrides {
  userMessageBg?: string;
  userMessageColor?: string;
  assistantMessageBg?: string;
  assistantMessageColor?: string;
  chatBg?: string;
}

export interface ThemeOverrides {
  light?: ColorOverrides;
  dark?: ColorOverrides;
  fontFamily?: string;
  fontSize?: number;
  iconSet?: IconSet;
}

export interface GenerationConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
}

export interface ChatSession {
  id: string;
  name: string;
  modelId: string;
  messages: ChatMessage[];
  systemPromptId?: string | null;
  generationConfig?: GenerationConfig;
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

export interface Toolchain {
  path: string;
  version?: string;
  name: string;
}
export interface ToolchainStatus {
    python: Toolchain[];
    java: Toolchain[];
    nodejs: Toolchain[];
    delphi: Toolchain[];
}

export interface Config {
  provider: LLMProvider;
  baseUrl: string;
  theme?: Theme;
  themeOverrides?: ThemeOverrides;
  logToFile?: boolean;
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
  // Toolchain paths
  selectedPythonPath?: string;
  selectedJavaPath?: string;
  selectedNodePath?: string;
  selectedDelphiPath?: string;
}

export interface ModelDetails {
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
  // Ollama specific details from /api/show
  modelfile?: string;
  parameters?: string;
  template?: string;
  num_ctx?: number;
}

export interface Model {
  id: string;
  name: string; // Ollama uses 'name', OpenAI-compat uses 'id'
  object: string;
  created: number;
  owned_by: string;
  // Ollama specific fields
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: ModelDetails;
}

export type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessageUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatMessageMetadata {
  usage?: ChatMessageUsage;
  speed?: number; // tokens per second
  ragContext?: {
    files: string[];
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatMessageContentPart[];
  metadata?: ChatMessageMetadata;
  fileModification?: {
    filePath: string;
    status: 'pending' | 'accepted' | 'rejected';
  };
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

export interface SystemStats {
  cpu: number;
  memory: {
    used: number;
    total: number;
  };
  gpu?: number;
}
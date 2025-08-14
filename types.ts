
export type Theme = 'light' | 'dark';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export type LLMProvider = 'Ollama' | 'LMStudio' | 'Custom';

export interface Config {
  provider: LLMProvider;
  baseUrl: string;
  theme?: Theme;
  logToFile?: boolean;
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


export type Theme = 'light' | 'dark';

export type LLMProvider = 'Ollama' | 'LMStudio' | 'Custom';

export interface Config {
  provider: LLMProvider;
  baseUrl: string;
  theme?: Theme;
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
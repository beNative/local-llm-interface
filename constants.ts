import type { Config, LLMProvider } from './types.ts';

export const PROVIDER_CONFIGS: Record<LLMProvider, Omit<Config, 'provider'>> = {
  Ollama: {
    baseUrl: 'http://localhost:11434/v1',
  },
  LMStudio: {
    baseUrl: 'http://127.0.0.1:1234/v1',
  },
  Custom: {
    baseUrl: 'http://localhost:8080/v1',
  },
};

export const APP_NAME = "Local LLM Interface";

export const DEFAULT_SYSTEM_PROMPT: string = "You are a helpful AI assistant. Answer the user's questions accurately and concisely.";
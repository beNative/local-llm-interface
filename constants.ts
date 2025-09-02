import type { Config, LLMProvider } from './types';

export const PROVIDER_CONFIGS: Record<LLMProvider, { baseUrl: string }> = {
  Ollama: {
    baseUrl: 'http://localhost:11434/v1',
  },
  LMStudio: {
    baseUrl: 'http://127.0.0.1:1234/v1',
  },
  OpenAI: {
    baseUrl: 'https://api.openai.com/v1',
  },
  'Google Gemini': {
    baseUrl: 'gemini-api', // Special identifier for the service layer
  },
  Custom: {
    baseUrl: 'http://localhost:8080/v1',
  },
};

export const APP_NAME = "Local LLM Interface";

export const DEFAULT_SYSTEM_PROMPT: string = "You are a helpful AI assistant. Answer the user's questions accurately and concisely.";

export const SESSION_NAME_PROMPT: string = `Based on the following conversation, generate a short, descriptive title (5 words or less) for the chat session. Only output the title, with no extra text or quotation marks.`;
import type { LLMProviderConfig } from './types';

export const DEFAULT_PROVIDERS: LLMProviderConfig[] = [
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', type: 'openai-compatible', isCustom: false },
  { id: 'lmstudio', name: 'LMStudio', baseUrl: 'http://127.0.0.1:1234/v1', type: 'openai-compatible', isCustom: false },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', type: 'openai-compatible', apiKeyName: 'openAI', isCustom: false },
  { id: 'google-gemini', name: 'Google Gemini', baseUrl: 'gemini-api', type: 'google-gemini', apiKeyName: 'google', isCustom: false },
];

export const APP_NAME = "Local LLM Interface";

export const DEFAULT_SYSTEM_PROMPT: string = "You are a helpful AI assistant. Answer the user's questions accurately and concisely.";

export const SESSION_NAME_PROMPT: string = `Based on the following conversation, generate a short, descriptive title (5 words or less) for the chat session. Only output the title, with no extra text or quotation marks.`;
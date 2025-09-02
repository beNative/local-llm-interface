import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type Content } from "@google/genai";
import type { Model, ChatMessage, ChatMessageMetadata, ChatMessageUsage, GenerationConfig, ModelDetails, Config, LLMProviderConfig, ChatMessageContentPart } from '../types';
import { logger } from './logger';

export class LLMServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export type StreamChunk = 
  { type: 'content'; text: string } | 
  { type: 'reasoning'; text: string };

const getApiKey = (provider: LLMProviderConfig, apiKeys: Config['apiKeys']): string | undefined => {
    if (!provider.apiKeyName) return undefined;
    return apiKeys?.[provider.apiKeyName];
};

export const fetchModels = async (provider: LLMProviderConfig, apiKeys: Config['apiKeys']): Promise<Model[]> => {
  if (provider.type === 'google-gemini') {
      const apiKey = getApiKey(provider, apiKeys);
      if (!apiKey) {
          throw new LLMServiceError('Google Gemini API key is not configured in Settings.');
      }
      // Gemini API doesn't have a model listing endpoint via the SDK that's equivalent.
      // We return a curated list of supported and recommended models.
      logger.info('Returning curated list of Google Gemini models.');
      return [
        { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', object: 'model', created: Date.now() / 1000, owned_by: 'google', },
      ];
  }

  try {
    const headers: Record<string, string> = {};
    if (provider.apiKeyName) {
        const apiKey = getApiKey(provider, apiKeys);
        if (!apiKey) {
            throw new LLMServiceError(`API key for ${provider.name} is not configured in Settings.`);
        }
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    logger.info(`Fetching models from ${provider.baseUrl}/models`);
    const response = await fetch(`${provider.baseUrl}/models`, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Failed to fetch models: ${response.status} ${response.statusText}. ${errorText}`;
      logger.error(errorMsg);
      throw new LLMServiceError(errorMsg);
    }
    const data = await response.json();
    logger.debug(`Received model data: ${JSON.stringify(data)}`);
    // Ollama has a slightly different format than standard OpenAI-compatible endpoints
    if (data.models) {
        logger.info(`Found ${data.models.length} models (Ollama format).`);
        return data.models.map((m: any) => ({
             ...m,
             id: m.name,
             created: m.modified_at ? Math.floor(new Date(m.modified_at).getTime() / 1000) : 0,
             owned_by: 'ollama',
             object: 'model',
        }));
    }
    if (data.data) {
        logger.info(`Found ${data.data.length} models (${provider.name} format).`);
        return data.data;
    }
    logger.warn('Models endpoint returned unknown format, no models found.');
    return [];
  } catch (error) {
    if (error instanceof LLMServiceError) throw error;
    logger.error(error instanceof Error ? error : String(error));
    let message = 'Could not connect to the specified server. Make sure the service is running, the Base URL is correct, and your API key is valid.';
    if (typeof window !== 'undefined' && !window.electronAPI) {
        message += ' When running in a browser, this could also be a Cross-Origin (CORS) issue. Using the desktop app is recommended.';
    }
    throw new LLMServiceError(message);
  }
};

export const fetchOllamaModelDetails = async (baseUrl: string, modelName: string): Promise<ModelDetails> => {
    const rootUrl = new URL(baseUrl);
    rootUrl.pathname = ''; // remove /v1 path
    const showUrl = new URL('/api/show', rootUrl.toString());

    try {
        logger.info(`Fetching details for model ${modelName} from ${showUrl.toString()}`);
        const response = await fetch(showUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch model details: ${response.status} ${response.statusText}. ${errorText}`);
        }
        const data = await response.json();
        return { ...data.details, modelfile: data.modelfile, parameters: data.parameters, template: data.template };
    } catch (error) {
        logger.error(`Error fetching Ollama model details: ${error}`);
        throw error;
    }
};

const textCompletionOpenAI = async (
    provider: LLMProviderConfig,
    apiKeys: Config['apiKeys'],
    modelId: string,
    messages: ChatMessage[],
    generationConfig?: GenerationConfig
): Promise<string> => {
    const { baseUrl, apiKeyName } = provider;
    if (apiKeyName) {
        const apiKey = getApiKey(provider, apiKeys);
        if (!apiKey) throw new LLMServiceError('API key is not configured for this provider.');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKeyName) {
        headers['Authorization'] = `Bearer ${getApiKey(provider, apiKeys)}`;
    }

    const options: Record<string, any> = {};
    if (generationConfig) {
        if (generationConfig.temperature !== undefined) options.temperature = generationConfig.temperature;
        if (generationConfig.topK !== undefined) options.top_k = generationConfig.topK;
        if (generationConfig.topP !== undefined) options.top_p = generationConfig.topP;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, messages, stream: false, ...options }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new LLMServiceError(`API error: ${response.status} ${response.statusText}. ${errorText}`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new LLMServiceError('API response did not contain message content.');
    return content;
};

const textCompletionGemini = async (
    provider: LLMProviderConfig,
    apiKeys: Config['apiKeys'],
    modelId: string,
    messages: ChatMessage[],
    generationConfig?: GenerationConfig
): Promise<string> => {
    const apiKey = getApiKey(provider, apiKeys);
    if (!apiKey) throw new LLMServiceError('Google Gemini API key is not configured.');

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = messages.find(m => m.role === 'system')?.content as string || undefined;
    const contents = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
            let parts: any[] = [];
            if (typeof m.content === 'string') {
                parts.push({ text: m.content });
            } else if (Array.isArray(m.content)) {
                parts = m.content.map(p => {
                    if (p.type === 'text') return { text: p.text };
                    if (p.type === 'image_url') {
                        const [header, data] = p.image_url.url.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1];
                        return { inlineData: { mimeType, data } };
                    }
                    return {};
                }).filter(Boolean);
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        });

    const response = await ai.models.generateContent({
        model: modelId,
        contents: contents,
        config: {
            ...generationConfig,
            systemInstruction,
        },
    });
    
    return response.text;
};

export const generateTextCompletion = async (
  provider: LLMProviderConfig,
  apiKeys: Config['apiKeys'],
  modelId: string,
  messages: ChatMessage[],
  generationConfig?: GenerationConfig
): Promise<string> => {
  try {
    logger.info(`Requesting non-streaming text completion from model ${modelId} via ${provider.name}`);

    if (provider.type === 'google-gemini') {
        return await textCompletionGemini(provider, apiKeys, modelId, messages, generationConfig);
    }
    
    // Default to OpenAI-compatible
    return await textCompletionOpenAI(provider, apiKeys, modelId, messages, generationConfig);

  } catch (error) {
     if (error instanceof LLMServiceError) throw error;
     if (error instanceof Error) {
        logger.error(error);
        throw error;
     }
     const unknownError = new LLMServiceError('An unknown error occurred during text completion.');
     logger.error(unknownError);
     throw unknownError;
  }
};

const streamChatCompletionGemini = async (
    provider: LLMProviderConfig,
    apiKeys: Config['apiKeys'],
    modelId: string,
    messages: ChatMessage[],
    signal: AbortSignal,
    onChunk: (chunk: StreamChunk) => void,
    onError: (error: Error) => void,
    onDone: (metadata: ChatMessageMetadata) => void,
    generationConfig?: GenerationConfig
) => {
    const apiKey = getApiKey(provider, apiKeys);
    if (!apiKey) {
        onError(new LLMServiceError('Google Gemini API key is not configured.'));
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = messages.find(m => m.role === 'system')?.content as string || undefined;
        
        const userAndAssistantMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

        // FIX: Correctly separate the history from the new prompt.
        // The history is all messages except the last two (the new user prompt and the blank assistant shell).
        const history = userAndAssistantMessages
            .slice(0, -2) 
            .map(m => {
                let parts: any[] = [];
                if (typeof m.content === 'string') {
                    parts.push({ text: m.content });
                } else {
                    parts = m.content.map(p => {
                        if (p.type === 'text') return { text: p.text };
                        if (p.type === 'image_url') {
                            const [header, data] = p.image_url.url.split(',');
                            const mimeType = header.match(/:(.*?);/)?.[1];
                            return { inlineData: { mimeType, data } };
                        }
                        return {};
                    }).filter(Boolean);
                }
                return { role: m.role === 'assistant' ? 'model' : 'user', parts };
            });

        // The latest prompt from the user is the second to last message in the array.
        const latestMessage = userAndAssistantMessages[userAndAssistantMessages.length - 2];
        if (!latestMessage || latestMessage.role !== 'user') {
            onError(new Error("Could not find user message to send."));
            return;
        }

        let latestMessageContent: (string | {inlineData: {mimeType: string, data: string}})[] = [];
        if (typeof latestMessage.content === 'string') {
            latestMessageContent.push(latestMessage.content);
        } else {
            latestMessage.content.forEach(p => {
                if (p.type === 'text') latestMessageContent.push(p.text);
                if (p.type === 'image_url') {
                    const [header, data] = p.image_url.url.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1];
                    if (mimeType && data) {
                        latestMessageContent.push({ inlineData: { mimeType, data } });
                    }
                }
            });
        }
        
        const chat = ai.chats.create({ 
            model: modelId, 
            history: history as Content[],
            config: {
                systemInstruction,
                ...generationConfig,
            },
        });

        const stream = await chat.sendMessageStream({ message: latestMessageContent });
        
        signal.addEventListener('abort', () => {
            // There's no direct abort method on the stream in the SDK.
            // This will stop processing, but the request might complete on the backend.
            logger.warn('Gemini stream abort requested. Processing will stop.');
        });

        for await (const chunk of stream) {
            if (signal.aborted) break;
            const text = chunk.text;
            if (text) {
                onChunk({ type: 'content', text });
            }
        }
        
        // Gemini streaming API does not provide token usage data.
        onDone({ usage: undefined });

    } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
    }
};


export const streamChatCompletion = async (
  provider: LLMProviderConfig,
  apiKeys: Config['apiKeys'],
  modelId: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: Error) => void,
  onDone: (metadata: ChatMessageMetadata) => void,
  generationConfig?: GenerationConfig
) => {
  const startTime = Date.now();
  let usage: ChatMessageUsage | undefined = undefined;
  
  if (provider.type === 'google-gemini') {
      return streamChatCompletionGemini(provider, apiKeys, modelId, messages, signal, onChunk, onError, onDone, generationConfig);
  }
  
  // Default to OpenAI-compatible
  try {
    logger.info(`Starting chat completion stream with model ${modelId}`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.apiKeyName) {
        const apiKey = getApiKey(provider, apiKeys);
        if (!apiKey) throw new LLMServiceError(`API Key for ${provider.name} not configured.`);
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const options: Record<string, any> = {};
    if (generationConfig) {
        if (generationConfig.temperature !== undefined) options.temperature = generationConfig.temperature;
        if (generationConfig.topK !== undefined) options.top_k = generationConfig.topK;
        if (generationConfig.topP !== undefined) options.top_p = generationConfig.topP;
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: modelId, messages, stream: true, ...options }),
      signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new LLMServiceError(`API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    if (!response.body) throw new LLMServiceError('Response body is empty.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const endTime = Date.now();
          const durationInSeconds = (endTime - startTime) / 1000;
          let speed: number | undefined = undefined;
          if (usage?.completion_tokens && durationInSeconds > 0) {
            speed = usage.completion_tokens / durationInSeconds;
          }
          logger.info('Chat stream finished.');
          onDone({ usage, speed });
          break;
        }
        const textChunk = decoder.decode(value, { stream: true });
        const lines = textChunk.split('\n').filter((line) => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') {
              // This is handled by `done` above
            } else {
                try {
                  const json = JSON.parse(data);
                  const delta = json.choices?.[0]?.delta;
                  if (delta?.content) onChunk({ type: 'content', text: delta.content });
                  if (delta?.reasoning_content) onChunk({ type: 'reasoning', text: delta.reasoning_content });
                  if (json.usage) usage = json.usage;
                  if (json.done === true && json.prompt_eval_count !== undefined) {
                      usage = {
                          prompt_tokens: json.prompt_eval_count,
                          completion_tokens: json.eval_count,
                          total_tokens: json.prompt_eval_count + (json.eval_count || 0),
                      };
                  }
                } catch (e) {
                   logger.warn(`Could not parse stream data chunk: ${e}, Data: "${data}"`);
                }
            }
          }
        }
      }

  } catch (error) {
     if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Chat stream aborted by user.');
        onDone({});
        return;
     }
     onError(error instanceof Error ? error : new Error(String(error)));
  }
};
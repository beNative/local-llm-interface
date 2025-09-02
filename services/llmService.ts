import { GoogleGenAI } from "@google/genai";
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
    // FIX: A series of cascading errors indicate a syntax issue. 
    // Rewriting message mapping logic to be more explicit and robust.
    const contents: ({ role: 'user' | 'model'; parts: any[] })[] = [];
    for (const m of messages) {
        if (m.role !== 'user' && m.role !== 'assistant') {
            continue;
        }

        const parts: any[] = [];
        if (typeof m.content === 'string') {
            if (m.content) parts.push({ text: m.content });
        } else if (Array.isArray(m.content)) {
            for (const p of m.content) {
                if (p.type === 'text' && p.text) {
                    parts.push({ text: p.text });
                } else if (p.type === 'image_url' && p.image_url?.url) {
                    const [header, data] = p.image_url.url.split(',');
                    if (header && data) {
                        const mimeType = header.match(/:(.*?);/)?.[1];
                        if (mimeType) {
                            parts.push({ inlineData: { mimeType, data } });
                        }
                    }
                }
            }
        }
        
        if (parts.length > 0) {
            contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
        }
    }

    if (contents.length === 0) {
        logger.warn('No valid content to send to Gemini API after filtering.');
        return '';
    }

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
        
        // FIX: A series of cascading errors indicate a syntax issue. 
        // Rewriting message mapping logic to be more explicit and robust, matching textCompletionGemini.
        const contents: ({ role: 'user' | 'model'; parts: any[] })[] = [];
        for (const m of messages) {
            if (m.role !== 'user' && m.role !== 'assistant') {
                continue;
            }
        
            const parts: any[] = [];
            if (typeof m.content === 'string') {
                // Only add a text part if the content is not empty
                if (m.content) {
                    parts.push({ text: m.content });
                }
            } else if (Array.isArray(m.content)) {
                for (const p of m.content) {
                    if (p.type === 'text' && p.text) {
                        parts.push({ text: p.text });
                    } else if (p.type === 'image_url' && p.image_url?.url) {
                        const [header, data] = p.image_url.url.split(',');
                        if (header && data) {
                            const mimeType = header.match(/:(.*?);/)?.[1];
                            if (mimeType) {
                                parts.push({ inlineData: { mimeType, data } });
                            }
                        }
                    }
                }
            }
            
            // If a message would result in empty parts, it's invalid for Gemini.
            if (parts.length > 0) {
                contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
            }
        }

        if (contents.length === 0) {
            logger.warn('Aborting Gemini stream: No valid content to send after filtering.');
            onDone({});
            return;
        }

        const stream = await ai.models.generateContentStream({
            model: modelId,
            contents: contents,
            config: {
                systemInstruction,
                ...generationConfig,
            },
        });
        
        signal.addEventListener('abort', () => {
            // There's no direct abort method on the stream in the SDK for stateless calls.
            // Breaking the loop will stop processing, but the request might complete on the backend.
            logger.warn('Gemini stream abort requested. Processing will stop.');
        });

        for await (const chunk of stream) {
            if (signal.aborted) break;
            const text = chunk.text;
            if (text) {
                onChunk({ type: 'content', text });
            }
        }
        
        // Gemini streaming API does not provide token usage data in chunks.
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
      streamChatCompletionGemini(provider, apiKeys, modelId, messages, signal, onChunk, onError, onDone, generationConfig);
      return;
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
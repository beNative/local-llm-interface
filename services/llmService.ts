import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Model, ChatMessage, ChatMessageMetadata, ChatMessageUsage, GenerationConfig, ModelDetails, Config, LLMProviderConfig, ChatMessageContentPart, Tool, ToolCall, ToolResponseMessage } from '../types';
import { logger } from './logger';

// Helper function to convert messages to Gemini's format, merging consecutive messages.
const toGeminiContents = (messages: ChatMessage[]): ({ role: 'user' | 'model'; parts: any[] })[] => {
    const mergedContents: ({ role: 'user' | 'model'; parts: any[] })[] = [];
    // Gemini API expects alternating user/model roles. Filter out system messages.
    const relevantMessages = messages.filter(m => m.role !== 'system');

    for (const message of relevantMessages) {
        if ('tool_calls' in message && message.tool_calls) {
            // This is a tool call request, handle accordingly
            const role = 'model'; // Tool calls are from the model
            const parts = message.tool_calls.map(tc => ({
                functionCall: {
                    name: tc.function.name,
                    args: JSON.parse(tc.function.arguments),
                }
            }));

            if (parts.length > 0) {
                 mergedContents.push({ role, parts });
            }
        } else if (message.role === 'tool') {
            // This is a tool response, handle accordingly
            const role = 'user'; // Tool responses are mapped to a "function" role, which is user-like
            const parts = [{
                functionResponse: {
                    name: (message as ToolResponseMessage).name,
                    response: {
                        content: message.content,
                    },
                }
            }];
            mergedContents.push({ role, parts });
        } else {
             // This is a standard text/image message
            const role = message.role === 'assistant' ? 'model' : 'user';
            const parts: any[] = [];
            if (typeof message.content === 'string') {
                if (message.content) {
                    parts.push({ text: message.content });
                }
            } else if (Array.isArray(message.content)) {
                for (const p of message.content) {
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
            
            if (parts.length === 0) {
                continue; // Skip messages with no valid parts
            }
             // Gemini requires alternating roles. If the new message has the same role as the last one, we must must merge.
            const lastEntry = mergedContents.length > 0 ? mergedContents[mergedContents.length - 1] : null;

            if (lastEntry && lastEntry.role === role) {
                lastEntry.parts.push(...parts);
            } else {
                mergedContents.push({ role, parts });
            }
        }
    }
    return mergedContents;
};

export class LLMServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export type StreamChunk = 
  { type: 'content'; text: string } | 
  { type: 'reasoning'; text: string } |
  { type: 'tool_calls', tool_calls: ToolCall[] };

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
        // The name property is required by our Model type and for fetching details.
        // OpenAI-compatible endpoints use 'id' for the model name.
        return data.data.map((m: any) => ({
          ...m,
          name: m.id,
        }));
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
        if (generationConfig.jsonMode) {
            options.response_format = { type: 'json_object' };
        }
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
    
    const contents = toGeminiContents(messages);

    if (contents.length === 0) {
        logger.warn('No valid content to send to Gemini API after filtering.');
        return '';
    }
    
    const config: Record<string, any> = {
        ...generationConfig,
        systemInstruction,
    };

    if (generationConfig?.jsonMode) {
        config.responseMimeType = "application/json";
    }

    // FIX: Use correct response type and access .text property
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelId,
        contents,
        config,
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
    tools: Tool[] | undefined,
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
        const contents = toGeminiContents(messages);

        if (contents.length === 0) {
            logger.warn('Aborting Gemini stream: No valid content to send after filtering.');
            onDone({});
            return;
        }

        const genAiTools = tools?.map(t => ({ functionDeclarations: [t.function] }));

        const stream = await ai.models.generateContentStream({
            model: modelId,
            contents,
            config: {
                systemInstruction,
                ...generationConfig,
                tools: genAiTools,
            },
        });
        
        signal.addEventListener('abort', () => {
            logger.warn('Gemini stream abort requested. Processing will stop.');
        });

        for await (const chunk of stream) {
            if (signal.aborted) break;
            // FIX: Use .text property to get text from streaming chunk, as per Gemini API guidelines.
            const text = chunk.text;
            if (text) {
                onChunk({ type: 'content', text });
            }
            const functionCalls = chunk.candidates?.[0].content.parts.filter(p => p.functionCall).map(p => p.functionCall);
            if(functionCalls && functionCalls.length > 0) {
                const tool_calls: ToolCall[] = functionCalls.map((fc: any) => {
                    const buffer = new Uint8Array(8);
                    window.crypto.getRandomValues(buffer);
                    const idSuffix = Array.from(buffer, byte => ('0' + byte.toString(16)).slice(-2)).join('');
                    return {
                        id: `call_${idSuffix}`,
                        type: 'function',
                        function: {
                            name: fc.name,
                            arguments: JSON.stringify(fc.args),
                        }
                    };
                });
                onChunk({ type: 'tool_calls', tool_calls });
            }
        }
        
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
  tools: Tool[] | undefined,
  signal: AbortSignal,
  onChunk: (chunk: StreamChunk) => void,
  onError: (error: Error) => void,
  onDone: (metadata: ChatMessageMetadata) => void,
  generationConfig?: GenerationConfig
) => {
  const startTime = Date.now();
  let usage: ChatMessageUsage | undefined = undefined;
  
  if (provider.type === 'google-gemini') {
      streamChatCompletionGemini(provider, apiKeys, modelId, messages, tools, signal, onChunk, onError, onDone, generationConfig);
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

    const body: Record<string, any> = { model: modelId, messages, stream: true, ...options };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new LLMServiceError(`API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    if (!response.body) throw new LLMServiceError('Response body is empty.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let toolCallChunks: { [key: number]: { id: string, name: string, arguments: string } } = {};

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
                  
                  // Handle tool call streaming
                  if (delta?.tool_calls) {
                      for (const toolCall of delta.tool_calls) {
                          const index = toolCall.index;
                          if (!toolCallChunks[index]) {
                              toolCallChunks[index] = { id: '', name: '', arguments: '' };
                          }
                          if (toolCall.id) toolCallChunks[index].id = toolCall.id;
                          if (toolCall.function?.name) toolCallChunks[index].name += toolCall.function.name;
                          if (toolCall.function?.arguments) toolCallChunks[index].arguments += toolCall.function.arguments;
                      }
                  }

                  if (json.choices?.[0]?.finish_reason === 'tool_calls') {
                        const final_tool_calls: ToolCall[] = Object.values(toolCallChunks).map(tc => ({
                            id: tc.id,
                            type: 'function',
                            function: { name: tc.name, arguments: tc.arguments }
                        }));
                        if (final_tool_calls.length > 0) {
                            onChunk({ type: 'tool_calls', tool_calls: final_tool_calls });
                        }
                        toolCallChunks = {};
                  }

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
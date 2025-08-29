import type { Model, ChatMessage, ChatMessageMetadata, ChatMessageUsage, GenerationConfig, ModelDetails } from '../types';
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

export const fetchModels = async (baseUrl: string): Promise<Model[]> => {
  try {
    logger.info(`Fetching models from ${baseUrl}/models`);
    const response = await fetch(`${baseUrl}/models`);
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
             // Normalize timestamp for UI consistency
             created: m.modified_at ? Math.floor(new Date(m.modified_at).getTime() / 1000) : 0,
             owned_by: 'ollama',
             object: 'model',
        }));
    }
    if (data.data) {
        logger.info(`Found ${data.data.length} models (OpenAI-compatible format).`);
        return data.data;
    }
    logger.warn('Models endpoint returned unknown format, no models found.');
    return [];
  } catch (error) {
    if (error instanceof LLMServiceError) throw error;
    logger.error(error instanceof Error ? error : String(error));
    let message = 'Could not connect to the specified server. Make sure the service is running and the Base URL is correct.';
    if (typeof window !== 'undefined' && !window.electronAPI) {
        message += ' When running in a browser, this could also be a Cross-Origin (CORS) issue. Using the desktop app is recommended.';
    }
    throw new LLMServiceError(message);
  }
};

export const fetchOllamaModelDetails = async (baseUrl: string, modelName: string): Promise<ModelDetails> => {
    // The baseUrl is for the v1 API, the /api/show is not. We need to construct the root URL.
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
        logger.debug(`Received model details: ${JSON.stringify(data)}`);
        
        // Parse context window from parameters string
        let num_ctx;
        if (data.parameters) {
            const match = /num_ctx\s+(\d+)/.exec(data.parameters);
            if (match) {
                num_ctx = parseInt(match[1], 10);
            }
        }

        return {
            ...data.details,
            modelfile: data.modelfile,
            parameters: data.parameters,
            template: data.template,
            num_ctx,
        };
    } catch (error) {
        logger.error(`Error fetching Ollama model details: ${error}`);
        throw error;
    }
};

export const generateTextCompletion = async (
  baseUrl: string,
  modelId: string,
  messages: ChatMessage[],
  generationConfig?: GenerationConfig
): Promise<string> => {
  try {
    logger.info(`Requesting non-streaming text completion from model ${modelId}`);

    const options: Record<string, any> = {};
    if (generationConfig) {
        if (generationConfig.temperature !== undefined) options.temperature = generationConfig.temperature;
        if (generationConfig.topK !== undefined) options.top_k = generationConfig.topK;
        if (generationConfig.topP !== undefined) options.top_p = generationConfig.topP;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        stream: false,
        ...options,
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error: ${response.status} ${response.statusText}. ${errorText}`;
        logger.error(errorMsg);
        throw new LLMServiceError(errorMsg);
    }
    
    const data = await response.json();
    logger.debug(`Received text completion data: ${JSON.stringify(data)}`);
    
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        logger.error('API response did not contain message content.');
        throw new LLMServiceError('API response did not contain message content.');
    }
    
    return content;

  } catch (error) {
     if (error instanceof LLMServiceError) throw error;
     if (error instanceof Error) {
        logger.error(error);
        throw error; // re-throw
     }
     const unknownError = new LLMServiceError('An unknown error occurred during text completion.');
     logger.error(unknownError);
     throw unknownError;
  }
};

export const streamChatCompletion = async (
  baseUrl: string,
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
  
  try {
    logger.info(`Starting chat completion stream with model ${modelId}`);

    const options: Record<string, any> = {};
    if (generationConfig) {
        if (generationConfig.temperature !== undefined) options.temperature = generationConfig.temperature;
        if (generationConfig.topK !== undefined) options.top_k = generationConfig.topK;
        if (generationConfig.topP !== undefined) options.top_p = generationConfig.topP;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        stream: true,
        ...options,
      }),
      signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API error: ${response.status} ${response.statusText}. ${errorText}`;
        logger.error(errorMsg);
        throw new LLMServiceError(errorMsg);
    }

    if (!response.body) {
      logger.error('Response body is empty for streaming chat.');
      throw new LLMServiceError('Response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const processStream = async () => {
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
        logger.debug(`Stream chunk received: ${textChunk}`);
        const lines = textChunk.split('\n').filter((line) => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') {
              const endTime = Date.now();
              const durationInSeconds = (endTime - startTime) / 1000;
              let speed: number | undefined = undefined;
              if (usage?.completion_tokens && durationInSeconds > 0) {
                speed = usage.completion_tokens / durationInSeconds;
              }
              logger.info('Chat stream sent [DONE] message.');
              onDone({ usage, speed });
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta;
              
              if (delta?.content) {
                onChunk({ type: 'content', text: delta.content });
              }
              if (delta?.reasoning_content) {
                onChunk({ type: 'reasoning', text: delta.reasoning_content });
              }

              // Capture usage stats, which can arrive in different formats
              if (json.usage) { // Standard OpenAI format
                  usage = json.usage;
              } else if (json.done === true && json.prompt_eval_count !== undefined) { // Ollama format
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
    
    await processStream();

  } catch (error) {
     if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Chat stream aborted by user.');
        onDone({}); // Call onDone to clean up state
        return;
     }
     if (error instanceof Error) {
        logger.error(error);
        onError(error);
     } else {
        const unknownError = new LLMServiceError('An unknown error occurred during chat streaming.');
        logger.error(unknownError);
        onError(unknownError);
     }
  }
};
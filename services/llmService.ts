
import type { Model, ChatMessage } from '../types';
import { logger } from './logger';

export class LLMServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

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
        return data.models.map((m: any) => ({ ...m, id: m.name }));
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

export const streamChatCompletion = async (
  baseUrl: string,
  modelId: string,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onError: (error: Error) => void,
  onDone: () => void
) => {
  try {
    logger.info(`Starting chat completion stream with model ${modelId}`);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        stream: true,
      }),
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        logger.info('Chat stream finished.');
        onDone();
        break;
      }
      const textChunk = decoder.decode(value, { stream: true });
      logger.debug(`Stream chunk received: ${textChunk}`);
      const lines = textChunk.split('\n').filter((line) => line.trim() !== '');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim() === '[DONE]') {
            logger.info('Chat stream sent [DONE] message.');
            onDone();
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content || '';
            if (content) {
              onChunk(content);
            }
          } catch (e) {
             logger.warn(`Could not parse stream data chunk: ${e}, Data: "${data}"`);
          }
        }
      }
    }
  } catch (error) {
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


import type { Model, ChatMessage } from '../types';

export class LLMServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMServiceError';
  }
}

export const fetchModels = async (baseUrl: string): Promise<Model[]> => {
  try {
    const response = await fetch(`${baseUrl}/models`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new LLMServiceError(`Failed to fetch models: ${response.status} ${response.statusText}. ${errorText}`);
    }
    const data = await response.json();
    // Ollama has a slightly different format than standard OpenAI-compatible endpoints
    if (data.models) {
        return data.models.map((m: any) => ({ ...m, id: m.name }));
    }
    if (data.data) {
        return data.data;
    }
    return [];
  } catch (error) {
    if (error instanceof LLMServiceError) throw error;
    console.error('Network or parsing error fetching models:', error);
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
        throw new LLMServiceError(`API error: ${response.status} ${response.statusText}. ${errorText}`);
    }

    if (!response.body) {
      throw new LLMServiceError('Response body is empty.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onDone();
        break;
      }
      const textChunk = decoder.decode(value, { stream: true });
      const lines = textChunk.split('\n').filter((line) => line.trim() !== '');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim() === '[DONE]') {
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
             console.warn('Could not parse stream data chunk:', e, 'Data:', `"${data}"`);
          }
        }
      }
    }
  } catch (error) {
     if (error instanceof Error) {
        onError(error);
     } else {
        onError(new LLMServiceError('An unknown error occurred during chat streaming.'));
     }
  }
};
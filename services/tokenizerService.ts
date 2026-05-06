import { AutoTokenizer } from '@xenova/transformers';
import { logger } from './logger';

// Cache for loaded tokenizers
const tokenizerCache = new Map<string, any>();

/**
 * Maps model IDs to their likely tokenizer families in transformers.js
 */
const getTokenizerName = (modelId: string): string => {
    const id = modelId.toLowerCase();
    if (id.includes('llama-3')) return 'Xenova/llama-3-tokenizer';
    if (id.includes('llama-2')) return 'Xenova/llama-tokenizer';
    if (id.includes('mistral') || id.includes('mixtral')) return 'Xenova/mistral-tokenizer';
    if (id.includes('gpt-4') || id.includes('gpt-3.5') || id.includes('gemini')) return 'Xenova/gpt-4';
    if (id.includes('claude')) return 'Xenova/claude-tokenizer';
    return 'Xenova/gpt-4'; // Safe default for BPE-based models
};

/**
 * Precise token counting service
 */
export const countTokens = async (text: string, modelId: string): Promise<{ count: number; verified: boolean }> => {
    if (!text) return { count: 0, verified: true };

    const tokenizerName = getTokenizerName(modelId);

    try {
        let tokenizer = tokenizerCache.get(tokenizerName);

        if (!tokenizer) {
            logger.info(`Loading tokenizer: ${tokenizerName}`);
            // We use local_files_only: false to allow initial download, 
            // then it will be cached in the user's home directory.
            tokenizer = await AutoTokenizer.from_pretrained(tokenizerName);
            tokenizerCache.set(tokenizerName, tokenizer);
        }

        const tokens = await tokenizer.encode(text);
        return { count: tokens.length, verified: true };
    } catch (error) {
        logger.warn(`Failed to use precise tokenizer ${tokenizerName}: ${error}. Falling back to heuristic.`);
        // Fallback to heuristic: ~3.5 chars per token
        return { count: Math.ceil(text.length / 3.5), verified: false };
    }
};

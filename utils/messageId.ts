/**
 * Generates a unique message ID using a timestamp and random suffix.
 * Uses crypto.randomUUID when available, otherwise falls back to
 * a simpler timestamp+random scheme.
 */
export function generateMessageId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for environments where crypto.randomUUID is unavailable
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

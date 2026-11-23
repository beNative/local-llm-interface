import type { ChatSession, ChatSessionSummary } from '../types';
import { logger } from './logger';

const BROWSER_INDEX_KEY = 'llm_sessions_index';
const BROWSER_SESSION_PREFIX = 'llm_session_';

export const toSessionSummary = (session: ChatSession): ChatSessionSummary => ({
  id: session.id,
  name: session.name,
  modelId: session.modelId,
  providerId: session.providerId,
  systemPromptId: session.systemPromptId ?? null,
  generationConfig: session.generationConfig,
  projectId: session.projectId ?? null,
  agentToolsEnabled: session.agentToolsEnabled,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  messageCount: Array.isArray(session.messages)
    ? session.messages.filter(m => m.role !== 'system' && m.role !== 'tool').length
    : 0,
});

export const sanitizeSessionRecord = <T extends Partial<ChatSessionSummary> & { id: string; provider?: string }>(
  raw: T,
  fallbackProviderId: string,
): { sanitized: T; migrated: boolean } => {
  let migrated = false;
  const copy: any = { ...raw };

  if (copy.provider && !copy.providerId) {
    let providerId = 'ollama';
    if (copy.provider === 'LMStudio') providerId = 'lmstudio';
    else if (copy.provider === 'OpenAI') providerId = 'openai';
    else if (copy.provider === 'Google Gemini') providerId = 'google-gemini';
    else if (copy.provider === 'Custom') providerId = fallbackProviderId || 'custom-migrated';
    copy.providerId = providerId;
    delete copy.provider;
    migrated = true;
  }

  if (!copy.providerId) {
    copy.providerId = fallbackProviderId || 'ollama';
    migrated = true;
  }

  if (copy.projectId === undefined) {
    copy.projectId = null;
    migrated = true;
  }

  return { sanitized: copy as T, migrated };
};

const readBrowserIndex = (): ChatSessionSummary[] => {
  try {
    const raw = localStorage.getItem(BROWSER_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeBrowserIndex = (summaries: ChatSessionSummary[]) => {
  try {
    localStorage.setItem(BROWSER_INDEX_KEY, JSON.stringify(summaries));
  } catch (error) {
    logger.error(`Failed to persist browser session index: ${error}`);
  }
};

export const listSessionSummaries = async (fallbackProviderId: string): Promise<ChatSessionSummary[]> => {
  let summaries: ChatSessionSummary[];
  if (window.electronAPI?.listSessions) {
    summaries = await window.electronAPI.listSessions();
  } else {
    summaries = readBrowserIndex();
  }

  let migratedCount = 0;
  const sanitized = summaries.map(s => {
    const result = sanitizeSessionRecord(s as any, fallbackProviderId);
    if (result.migrated) migratedCount++;
    return result.sanitized as ChatSessionSummary;
  });

  if (migratedCount > 0) {
    logger.info(`Sanitized/migrated ${migratedCount} session summary record(s) to include a valid providerId.`);
  }

  return sanitized;
};

export const loadSessionById = async (
  sessionId: string,
  fallbackProviderId: string,
): Promise<ChatSession | null> => {
  if (!sessionId) return null;

  let session: ChatSession | null = null;
  if (window.electronAPI?.getSession) {
    session = await window.electronAPI.getSession(sessionId);
  } else {
    try {
      const raw = localStorage.getItem(`${BROWSER_SESSION_PREFIX}${sessionId}`);
      if (raw) {
        session = JSON.parse(raw) as ChatSession;
      }
    } catch (error) {
      logger.error(`Failed to load browser session ${sessionId}: ${error}`);
    }
  }

  if (!session) return null;

  const { sanitized, migrated } = sanitizeSessionRecord(session as any, fallbackProviderId);
  if (!Array.isArray(sanitized.messages)) {
    sanitized.messages = [];
  }
  if (migrated) {
    void saveSessionToStore(sanitized as ChatSession);
  }
  return sanitized as ChatSession;
};

export const saveSessionToStore = async (session: ChatSession): Promise<void> => {
  if (!session?.id) return;

  if (window.electronAPI?.saveSession) {
    await window.electronAPI.saveSession(session);
    return;
  }

  try {
    localStorage.setItem(`${BROWSER_SESSION_PREFIX}${session.id}`, JSON.stringify(session));
    const currentIndex = readBrowserIndex();
    const summary = toSessionSummary(session);
    const existingIdx = currentIndex.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      currentIndex[existingIdx] = summary;
    } else {
      currentIndex.push(summary);
    }
    writeBrowserIndex(currentIndex);
  } catch (error) {
    logger.error(`Failed to save browser session ${session.id}: ${error}`);
  }
};

export const deleteSessionsFromStore = async (sessionIds: string[]): Promise<void> => {
  if (!sessionIds || sessionIds.length === 0) return;

  if (window.electronAPI?.deleteSessions) {
    await window.electronAPI.deleteSessions(sessionIds);
    return;
  }

  const idSet = new Set(sessionIds);
  for (const id of sessionIds) {
    try {
      localStorage.removeItem(`${BROWSER_SESSION_PREFIX}${id}`);
    } catch {
      // ignore
    }
  }
  const nextIndex = readBrowserIndex().filter(s => !idSet.has(s.id));
  writeBrowserIndex(nextIndex);
};

export const importLegacySessionsToStore = async (
  sessions: ChatSession[],
  fallbackProviderId: string,
): Promise<ChatSessionSummary[]> => {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return listSessionSummaries(fallbackProviderId);
  }

  const cleaned = sessions
    .filter(s => s && typeof s.id === 'string')
    .map(s => sanitizeSessionRecord(s as any, fallbackProviderId).sanitized as ChatSession);

  if (window.electronAPI?.importLegacySessions) {
    return await window.electronAPI.importLegacySessions(cleaned);
  }

  const summaryMap = new Map<string, ChatSessionSummary>();
  for (const existing of readBrowserIndex()) {
    summaryMap.set(existing.id, existing);
  }
  for (const session of cleaned) {
    try {
      localStorage.setItem(`${BROWSER_SESSION_PREFIX}${session.id}`, JSON.stringify(session));
      summaryMap.set(session.id, toSessionSummary(session));
    } catch (error) {
      logger.error(`Failed to migrate browser session ${session.id}: ${error}`);
    }
  }
  const nextIndex = Array.from(summaryMap.values());
  writeBrowserIndex(nextIndex);
  return nextIndex;
};

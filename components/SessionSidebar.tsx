import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { ChatSession } from '../types';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onDeleteMultipleSessions?: (sessionIds: string[]) => void;
  onGenerateSessionName: (sessionId: string) => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onDeleteMultipleSessions,
  onGenerateSessionName,
}) => {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const newChatTooltip = useTooltipTrigger('Start a new conversation');
  const multiSelectTooltip = useTooltipTrigger(isSelectMode ? 'Exit select mode' : 'Select multiple conversations');
  const generateNameTooltip = useTooltipTrigger('Generate name');
  const deleteSessionTooltip = useTooltipTrigger('Delete session');
  const navRef = useRef<HTMLElement>(null);

  const getSessionTime = (session: ChatSession) => {
    return session.updatedAt || session.createdAt || parseInt(session.id.replace('session_', '')) || 0;
  };

  /** Flat, sorted list of all sessions (newest first) */
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a));
  }, [sessions]);

  const groupSessions = (sessionsList: ChatSession[]) => {
    const sorted = sortedSessions;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;
    const thirtyDaysAgo = today - 30 * 86400000;

    const groups: { title: string; items: ChatSession[] }[] = [
      { title: 'Today', items: [] },
      { title: 'Yesterday', items: [] },
      { title: 'Previous 7 Days', items: [] },
      { title: 'Previous 30 Days', items: [] },
      { title: 'Earlier', items: [] },
    ];

    sorted.forEach(session => {
      const time = getSessionTime(session);
      if (time >= today) groups[0].items.push(session);
      else if (time >= yesterday) groups[1].items.push(session);
      else if (time >= sevenDaysAgo) groups[2].items.push(session);
      else if (time >= thirtyDaysAgo) groups[3].items.push(session);
      else groups[4].items.push(session);
    });

    return groups.filter(g => g.items.length > 0);
  };

  const groupedSessions = groupSessions(sessions);

  const toggleSelectSession = (sessionId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(sessions.map(s => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);
    if (onDeleteMultipleSessions) {
      onDeleteMultipleSessions(idsArray);
    } else {
      idsArray.forEach(id => onDeleteSession(id));
    }
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  /**
   * Keyboard navigation handler for the session list.
   */
  const handleNavKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const nav = navRef.current;
    if (!nav) return;

    const sessionButtons = Array.from(
      nav.querySelectorAll<HTMLButtonElement>('[data-session-id]')
    );
    if (sessionButtons.length === 0) return;

    const currentIndex = sessionButtons.findIndex(
      btn => btn === document.activeElement || btn.parentElement?.parentElement === document.activeElement?.closest('[data-session-row]')
    );

    let handled = false;

    if (e.key === 'ArrowDown') {
      const nextIndex = currentIndex < sessionButtons.length - 1 ? currentIndex + 1 : 0;
      sessionButtons[nextIndex].focus();
      const sessionId = sessionButtons[nextIndex].getAttribute('data-session-id');
      if (sessionId && !isSelectMode) onSelectSession(sessionId);
      handled = true;
    } else if (e.key === 'ArrowUp') {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionButtons.length - 1;
      sessionButtons[prevIndex].focus();
      const sessionId = sessionButtons[prevIndex].getAttribute('data-session-id');
      if (sessionId && !isSelectMode) onSelectSession(sessionId);
      handled = true;
    } else if (e.key === 'Enter' || e.key === ' ') {
      const focused = document.activeElement as HTMLButtonElement;
      const sessionId = focused?.getAttribute('data-session-id');
      if (sessionId) {
        if (isSelectMode) {
          toggleSelectSession(sessionId);
        } else {
          onSelectSession(sessionId);
        }
        handled = true;
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const focused = document.activeElement as HTMLButtonElement;
      const sessionId = focused?.getAttribute('data-session-id');
      if (sessionId && !isSelectMode) {
        const nextIndex = currentIndex < sessionButtons.length - 1 ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= 0 && nextIndex < sessionButtons.length && nextIndex !== currentIndex) {
          sessionButtons[nextIndex].focus();
        }
        onDeleteSession(sessionId);
        handled = true;
      }
    } else if (e.key === 'Home') {
      sessionButtons[0]?.focus();
      handled = true;
    } else if (e.key === 'End') {
      sessionButtons[sessionButtons.length - 1]?.focus();
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [onSelectSession, onDeleteSession, isSelectMode]);

  return (
    <aside className="h-full bg-[--bg-sidebar]/80 backdrop-blur-md border-r border-[--border-primary]/70 flex flex-col select-none">
      {/* Top Action Header */}
      <div className="p-3 border-b border-[--border-primary]/40 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <button
            {...newChatTooltip}
            onClick={onNewChat}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg text-white bg-[--accent-chat] hover:opacity-90 transition-all shadow-md shadow-blue-500/20"
          >
            <Icon name="plus" className="w-4 h-4" />
            New Chat
          </button>
          {sessions.length > 0 && (
            <button
              {...multiSelectTooltip}
              onClick={() => {
                setIsSelectMode(prev => !prev);
                setSelectedIds(new Set());
              }}
              className={`p-2 rounded-lg border transition-all ${
                isSelectMode
                  ? 'bg-[--accent-chat]/20 border-[--accent-chat] text-[--accent-chat]'
                  : 'bg-[--bg-tertiary] border-[--border-secondary] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover]'
              }`}
              aria-label="Toggle multi-select"
            >
              <Icon name="clipboard" className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Multi-Select Toolbar */}
        {isSelectMode && (
          <div className="p-2 rounded-lg bg-[--bg-tertiary] border border-[--border-secondary] space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium text-[--text-secondary]">
              <span>{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-[--accent-chat] hover:underline"
                >
                  All
                </button>
                <span className="text-[--text-muted]">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-[--text-muted] hover:text-[--text-primary]"
                >
                  None
                </button>
              </div>
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                <Icon name="trash" className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Session Group List */}
      <nav
        ref={navRef}
        role="listbox"
        aria-label="Chat sessions"
        aria-activedescendant={activeSessionId ? `session-${activeSessionId}` : undefined}
        onKeyDown={handleNavKeyDown}
        className="flex-1 overflow-y-auto px-2 py-3 custom-scrollbar"
      >
        {groupedSessions.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} className="mb-5 last:mb-0">
            <div className="px-2 py-1.5">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">{group.title}</h3>
            </div>
            <div className="space-y-1">
              {group.items.map((session) => {
                const isSelected = selectedIds.has(session.id);
                const isActive = activeSessionId === session.id && !isSelectMode;

                return (
                  <div
                    key={session.id}
                    data-session-row
                    className={`group w-full text-left rounded-xl text-sm transition-all relative overflow-hidden border ${
                      isSelected
                        ? 'border-[--accent-chat] bg-[--accent-chat]/10 text-[--text-primary]'
                        : isActive
                        ? 'border-[--border-primary] bg-[--bg-hover] text-[--text-primary]'
                        : 'border-transparent text-[--text-secondary] hover:bg-[--bg-hover]/50 hover:text-[--text-primary]'
                    }`}
                  >
                    <div className="flex items-stretch">
                      {/* Selection Checkbox in Multi-Select Mode */}
                      {isSelectMode && (
                        <div className="flex items-center pl-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectSession(session.id)}
                            className="w-4 h-4 rounded border-[--border-secondary] bg-[--bg-tertiary] text-[--accent-chat] focus:ring-[--accent-chat]"
                          />
                        </div>
                      )}

                      <button
                        id={`session-${session.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-session-id={session.id}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleSelectSession(session.id);
                          } else {
                            onSelectSession(session.id);
                          }
                        }}
                        className="flex flex-1 items-start gap-2.5 text-left truncate px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-chat] focus-visible:ring-inset rounded-xl"
                      >
                        <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${
                          isActive 
                            ? 'bg-[--accent-chat] text-white' 
                            : 'bg-[--bg-tertiary] text-[--text-muted]'
                        }`}>
                            <Icon name="messageSquare" className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 truncate">
                          <span className="block font-medium truncate mb-0.5 text-xs text-[--text-primary]" title={session.name}>
                            {session.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-[--text-muted] font-mono uppercase tracking-wider">
                            {session.projectId && <Icon name="code" className="w-3 h-3 flex-shrink-0 text-emerald-400" />}
                            <span className="truncate">{session.modelId}</span>
                          </div>
                        </div>
                      </button>
                      
                      {!isSelectMode && (
                        <div className="flex flex-col justify-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <button
                            aria-label="Generate session name"
                            {...generateNameTooltip}
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onGenerateSessionName(session.id);
                            }}
                            className="p-1 rounded text-[--text-muted] hover:bg-[--bg-tertiary] hover:text-[--text-primary]"
                          >
                            <Icon name="sparkles" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            aria-label="Delete session"
                            {...deleteSessionTooltip}
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="p-1 rounded text-[--text-muted] hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Icon name="trash" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[--accent-chat] rounded-r-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-[--text-muted]">No recent chats</p>
          </div>
        )}
      </nav>
    </aside>
  );
};

export default SessionSidebar;

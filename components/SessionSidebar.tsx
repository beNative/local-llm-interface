import React, { useCallback, useMemo, useRef } from 'react';
import type { ChatSession } from '../types';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onGenerateSessionName: (sessionId: string) => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectSession, onDeleteSession, onGenerateSessionName }) => {
  const newChatTooltip = useTooltipTrigger('Start a new conversation');
  const generateNameTooltip = useTooltipTrigger('Generate name');
  const deleteSessionTooltip = useTooltipTrigger('Delete session');
  const navRef = useRef<HTMLElement>(null);

  const getSessionTime = (session: ChatSession) => {
    return session.updatedAt || session.createdAt || parseInt(session.id.replace('session_', '')) || 0;
  };

  /** Flat, sorted list of all sessions (newest first) used for keyboard nav ordering. */
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a));
  }, [sessions]);

  const groupSessions = (sessions: ChatSession[]) => {
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

  /**
   * Keyboard navigation handler for the session list.
   * - ArrowDown / ArrowUp: move focus to next/previous session
   * - Enter / Space: select the focused session
   * - Delete / Backspace: delete the focused session
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
      if (sessionId) onSelectSession(sessionId);
      handled = true;
    } else if (e.key === 'ArrowUp') {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionButtons.length - 1;
      sessionButtons[prevIndex].focus();
      const sessionId = sessionButtons[prevIndex].getAttribute('data-session-id');
      if (sessionId) onSelectSession(sessionId);
      handled = true;
    } else if (e.key === 'Enter' || e.key === ' ') {
      const focused = document.activeElement as HTMLButtonElement;
      const sessionId = focused?.getAttribute('data-session-id');
      if (sessionId) {
        onSelectSession(sessionId);
        handled = true;
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const focused = document.activeElement as HTMLButtonElement;
      const sessionId = focused?.getAttribute('data-session-id');
      if (sessionId) {
        // Move focus to the next session before deleting
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
  }, [onSelectSession, onDeleteSession]);

  return (
    <aside className="h-full bg-[--bg-sidebar]/80 backdrop-blur-md border-r border-[--border-primary] flex flex-col">
      <div className="p-4 flex-shrink-0">
        <button
          {...newChatTooltip}
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold uppercase tracking-wider rounded-xl text-white bg-[--accent-chat] hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
        >
          <Icon name="plus" className="w-4 h-4" />
          New Chat
        </button>
      </div>
      
      <nav
        ref={navRef}
        role="listbox"
        aria-label="Chat sessions"
        aria-activedescendant={activeSessionId ? `session-${activeSessionId}` : undefined}
        onKeyDown={handleNavKeyDown}
        className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar"
      >
        {groupedSessions.map((group) => (
          <div key={group.title} role="group" aria-label={group.title} className="mb-6 last:mb-0">
            <div className="px-2 py-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">{group.title}</h3>
            </div>
            <div className="space-y-0.5">
              {group.items.map((session) => (
                <div
                  key={session.id}
                  data-session-row
                  className={`group w-full text-left rounded-xl text-sm transition-all relative overflow-hidden ${
                    activeSessionId === session.id
                      ? 'bg-[--bg-hover] text-[--text-primary]'
                      : 'text-[--text-secondary] hover:bg-[--bg-hover]/50 hover:text-[--text-primary]'
                  }`}
                >
                  <div className="flex items-stretch">
                    <button
                      id={`session-${session.id}`}
                      role="option"
                      aria-selected={activeSessionId === session.id}
                      data-session-id={session.id}
                      onClick={() => onSelectSession(session.id)}
                      className="flex flex-1 items-start gap-3 text-left truncate px-3 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-chat] focus-visible:ring-inset rounded-xl"
                    >
                      <div className={`mt-0.5 p-1.5 rounded-lg ${activeSessionId === session.id ? 'bg-[--accent-chat] text-white' : 'bg-[--bg-tertiary] text-[--text-muted]'}`}>
                          <Icon name="messageSquare" className="w-3.5 h-3.5 flex-shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <span className="block font-medium truncate mb-0.5" title={session.name}>
                          {session.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-[--text-muted] font-medium uppercase tracking-wider">
                          {session.projectId && <Icon name="code" className="w-3 h-3 flex-shrink-0 text-green-500" />}
                          <span className="truncate">{session.modelId}</span>
                        </div>
                      </div>
                    </button>
                    
                    <div className="flex flex-col justify-center gap-1 pr-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button
                        aria-label="Generate session name"
                        {...generateNameTooltip}
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSessionName(session.id);
                        }}
                        className="p-1.5 rounded-lg text-[--text-muted] hover:bg-[--bg-tertiary] hover:text-[--text-primary]"
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
                        className="p-1.5 rounded-lg text-[--text-muted] hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  {activeSessionId === session.id && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[--accent-chat]" />
                  )}
                </div>
              ))}
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

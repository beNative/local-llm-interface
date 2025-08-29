import React from 'react';
import type { ChatSession } from '../types';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';
import MessageSquareIcon from './icons/MessageSquareIcon';
import SparklesIcon from './icons/SparklesIcon';

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onGenerateSessionName: (sessionId: string) => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectSession, onDeleteSession, onGenerateSessionName }) => {
  return (
    <aside className="h-full bg-[--bg-secondary] border-r border-[--border-primary] flex flex-col">
      <div className="p-3 flex-shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white bg-[--accent-chat] hover:brightness-95 transition-all shadow-sm"
          title="Start a new conversation"
        >
          <PlusIcon className="w-4 h-4" />
          New Chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group w-full text-left rounded-lg text-sm font-medium transition-colors relative ${
              activeSessionId === session.id
                ? 'bg-[--bg-hover]'
                : 'text-[--text-secondary] hover:bg-[--bg-hover]'
            }`}
          >
            {activeSessionId === session.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-1 bg-[--accent-chat] rounded-r-full" />
            )}
            <button onClick={() => onSelectSession(session.id)} className="w-full flex items-start gap-2.5 text-left truncate px-3 py-2">
                <MessageSquareIcon className="w-4 h-4 flex-shrink-0 mt-1" />
                <div className="flex-1 truncate pr-14">
                    <span className={`block truncate ${activeSessionId === session.id ? 'text-[--text-primary]' : ''}`}>{session.name}</span>
                    <span className="block text-xs opacity-70 truncate font-normal">{session.modelId}</span>
                </div>
            </button>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-transparent rounded-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateSessionName(session.id);
                }}
                className="p-1.5 rounded-md text-[--text-muted] hover:bg-[--accent-chat]/10 hover:text-[--accent-chat]"
                title="Generate name"
              >
                <SparklesIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteSession(session.id);
                }}
                className="p-1.5 rounded-md text-[--text-muted] hover:bg-red-500/10 hover:text-red-500"
                title="Delete session"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default SessionSidebar;
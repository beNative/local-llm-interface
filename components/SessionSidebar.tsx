import React from 'react';
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

  return (
    <aside className="h-full bg-[--bg-sidebar] border-r border-[--border-primary] flex flex-col">
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
      
      <div className="px-4 py-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Recent Chats</h3>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group w-full text-left rounded-xl text-sm transition-all relative overflow-hidden ${
              activeSessionId === session.id
                ? 'bg-[--bg-hover] text-[--text-primary]'
                : 'text-[--text-secondary] hover:bg-[--bg-hover]/50 hover:text-[--text-primary]'
            }`}
          >
            <div className="flex items-stretch">
              <button
                onClick={() => onSelectSession(session.id)}
                className="flex flex-1 items-start gap-3 text-left truncate px-3 py-3"
              >
                <div className={`mt-0.5 p-1.5 rounded-lg ${activeSessionId === session.id ? 'bg-[--accent-chat] text-white' : 'bg-[--bg-tertiary] text-[--text-muted]'}`}>
                    <Icon name="messageSquare" className="w-3.5 h-3.5 flex-shrink-0" />
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <span className="block font-medium truncate mb-0.5">
                    {session.name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-[--text-muted] font-medium uppercase tracking-wider">
                    {session.projectId && <Icon name="code" className="w-3 h-3 flex-shrink-0 text-green-500" />}
                    <span className="truncate">{session.modelId}</span>
                  </div>
                </div>
              </button>
              
              <div className="flex flex-col justify-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  {...generateNameTooltip}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateSessionName(session.id);
                  }}
                  className="p-1.5 rounded-lg text-[--text-muted] hover:bg-[--bg-tertiary] hover:text-[--text-primary]"
                >
                  <Icon name="sparkles" className="w-3.5 h-3.5" />
                </button>
                <button
                  {...deleteSessionTooltip}
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
      </nav>
    </aside>
  );
};

export default SessionSidebar;

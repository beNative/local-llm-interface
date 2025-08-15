

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Config, Model, ChatMessage, Theme, CodeProject, ChatSession, ChatMessageContentPart, PredefinedPrompt } from './types';
import { APP_NAME, PROVIDER_CONFIGS, DEFAULT_SYSTEM_PROMPT, SESSION_NAME_PROMPT } from './constants';
import { fetchModels, streamChatCompletion, LLMServiceError, generateTextCompletion } from './services/llmService';
import { logger } from './services/logger';
import SettingsPanel from './components/SettingsPanel';
import ModelSelector from './components/ModelSelector';
import ChatView from './components/ChatView';
import ThemeSwitcher from './components/ThemeSwitcher';
import LoggingPanel from './components/LoggingPanel';
import InfoView from './components/InfoView';
import ProjectsView from './components/ProjectsView';
import ApiView from './components/ApiView';
import FileTextIcon from './components/icons/FileTextIcon';
import SettingsIcon from './components/icons/SettingsIcon';
import InfoIcon from './components/icons/InfoIcon';
import MessageSquareIcon from './components/icons/MessageSquareIcon';
import CodeIcon from './components/icons/CodeIcon';
import ServerIcon from './components/icons/ServerIcon';
import SessionSidebar from './components/SessionSidebar';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  view: View;
}> = ({ active, onClick, children, ariaLabel, view }) => {
    const accentVar = `var(--accent-${view})`;
    return (
        <button
            onClick={onClick}
            aria-label={ariaLabel}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                active
                    ? 'shadow-sm text-white'
                    : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'
            }`}
            style={{
                backgroundColor: active ? accentVar : 'transparent',
                color: active ? 'var(--text-on-accent)' : '',
            }}
        >
            {children}
        </button>
    );
};

const RunOutputModal: React.FC<{
    runOutput: { title: string; stdout: string; stderr: string };
    onClose: () => void;
}> = ({ runOutput, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={onClose}>
        <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-[--border-primary] flex-shrink-0 flex justify-between items-center">
                <h2 className="text-lg font-bold text-[--text-primary]">{runOutput.title}</h2>
                <button onClick={onClose} className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] leading-none text-2xl">&times;</button>
            </header>
            <main className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                {runOutput.stdout && (
                    <div>
                        <h3 className="text-[--text-muted] font-sans font-semibold text-sm mb-1 uppercase">Output (stdout)</h3>
                        <pre className="whitespace-pre-wrap text-[--text-secondary] bg-[--bg-tertiary] p-3 rounded-lg">{runOutput.stdout}</pre>
                    </div>
                )}
                {runOutput.stderr && (
                    <div className="mt-4">
                        <h3 className="text-red-500 font-sans font-semibold text-sm mb-1 uppercase">Error (stderr)</h3>
                        <pre className="whitespace-pre-wrap text-red-500 bg-red-900/20 p-3 rounded-lg">{runOutput.stderr}</pre>
                    </div>
                )}
                {!runOutput.stdout && !runOutput.stderr && <p className="text-[--text-muted] font-sans">The script produced no output.</p>}
            </main>
            <footer className="p-3 border-t border-[--border-primary] text-right">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-md hover:bg-[--bg-hover]">Close</button>
            </footer>
        </div>
    </div>
);


const App: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('chat');
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState('');
  const [runOutput, setRunOutput] = useState<{ title: string; stdout: string; stderr: string; } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = useRef(false);


  // Derived state from config
  const sessions = config?.sessions || [];
  const activeSessionId = config?.activeSessionId;
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Effect for one-time app initialization and loading settings
  useEffect(() => {
    logger.info('App initializing...');
    const loadInitialConfig = async () => {
      logger.debug('Loading initial config.');
      const defaultConfig: Config = { 
        provider: 'Ollama', 
        baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
        theme: 'dark',
        themeOverrides: {},
        logToFile: false,
        pythonProjectsPath: '',
        nodejsProjectsPath: '',
        webAppsPath: '',
        javaProjectsPath: '',
        projects: [],
        pythonCommand: 'python',
        apiRecentPrompts: [],
        sessions: [],
        predefinedPrompts: [],
      };
      
      let loadedConfig = defaultConfig;

      if (window.electronAPI) {
        setIsElectron(true);
        logger.info('Electron environment detected.');
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          logger.info('Loaded settings from file.');
          loadedConfig = { ...defaultConfig, ...savedSettings, projects: savedSettings.projects || [], sessions: savedSettings.sessions || [] };
        } else {
          logger.info('No settings file found, using defaults.');
        }
      } else {
        logger.info('Running in browser environment.');
        const localSettings = localStorage.getItem('llm_config');
        if (localSettings) {
          try {
            const savedSettings = JSON.parse(localSettings);
            logger.info('Loaded settings from localStorage.');
            loadedConfig = { ...defaultConfig, ...savedSettings, projects: savedSettings.projects || [], sessions: savedSettings.sessions || [] };
          } catch (e) {
             logger.error("Failed to parse local settings, using defaults.");
          }
        }
      }
      
      setConfig(loadedConfig);
      logger.setConfig({ logToFile: loadedConfig.logToFile });
    };
    loadInitialConfig();
  }, []);
  
  // Effect to apply the theme class to the document.
  useEffect(() => {
    if (!config) return;
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    logger.debug(`Theme set to: ${config.theme}`);
  }, [config?.theme]);
  
  // Effect to apply theme overrides as CSS variables.
  useEffect(() => {
    const styleElement = document.getElementById('theme-overrides') || document.createElement('style');
    styleElement.id = 'theme-overrides';

    const overrides = config?.themeOverrides;
    if (overrides && Object.values(overrides).some(v => v)) {
      const css = `
        :root {
          ${overrides.chatBg ? `--chat-bg-color: ${overrides.chatBg};` : ''}
          ${overrides.userMessageBg ? `--user-message-bg-color: ${overrides.userMessageBg};` : ''}
          ${overrides.userMessageColor ? `--user-message-text-color: ${overrides.userMessageColor};` : ''}
          ${overrides.assistantMessageBg ? `--assistant-message-bg-color: ${overrides.assistantMessageBg};` : ''}
          ${overrides.assistantMessageColor ? `--assistant-message-text-color: ${overrides.assistantMessageColor};` : ''}
          ${overrides.fontFamily ? `--chat-font-family: ${overrides.fontFamily};` : ''}
          ${overrides.fontSize ? `--chat-font-size: ${overrides.fontSize}px;` : ''}
        }
      `;
      styleElement.innerHTML = css;
      document.head.appendChild(styleElement);
      logger.debug('Applied custom theme overrides.');
    } else {
      styleElement.innerHTML = ''; // Clear styles if no overrides
      logger.debug('No theme overrides to apply.');
    }
  }, [config?.themeOverrides]);

  // Effect to persist config changes.
  useEffect(() => {
    if (!config) return;
    if (window.electronAPI) {
      window.electronAPI.saveSettings(config);
    } else {
      localStorage.setItem('llm_config', JSON.stringify(config));
    }
    logger.debug('Configuration persisted.');
  }, [config]);


  const handleConfigChange = (newConfig: Config) => {
    if (!config) return;
    logger.info('Configuration change requested.');

    const needsModelReload = newConfig.baseUrl !== config.baseUrl || newConfig.provider !== config.provider;

    if (needsModelReload) {
        logger.info('Provider or Base URL changed, resetting sessions and returning to model selection.');
        setConfig({
            ...newConfig,
            sessions: [],
            activeSessionId: undefined,
        });
    } else {
        setConfig(newConfig);
    }

    logger.setConfig({ logToFile: newConfig.logToFile });
  };

  const handleThemeToggle = () => {
      setConfig(currentConfig => {
        if (!currentConfig) return null;
        const newTheme = currentConfig.theme === 'light' ? 'dark' : 'light';
        logger.info(`Theme toggled to ${newTheme}.`);
        return { ...currentConfig, theme: newTheme };
      });
  };

  const loadModels = useCallback(async () => {
    if (!config?.baseUrl) {
        setError("Base URL not configured. Please check your settings.");
        setModels([]);
        setIsLoadingModels(false);
        return;
    }
    setIsLoadingModels(true);
    setError(null);
    try {
      const fetchedModels = await fetchModels(config.baseUrl);
      setModels(fetchedModels);
    } catch (err) {
      const errorMessage = err instanceof LLMServiceError ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [config?.baseUrl]);

  useEffect(() => {
    // Load models if config is ready and we are on a view that needs them
    if (config?.baseUrl && (view === 'chat' || view === 'api')) {
      loadModels();
    }
  }, [view, config?.baseUrl, loadModels]);
  
  const handleSelectSession = (sessionId: string) => {
    setConfig(c => c ? ({ ...c, activeSessionId: sessionId }) : null);
    setView('chat');
  };

  const handleNewChat = () => {
    setConfig(c => c ? ({ ...c, activeSessionId: undefined }) : null);
    setView('chat');
  };

  const handleDeleteSession = (sessionId: string) => {
    setConfig(c => {
      if (!c) return null;
      const newSessions = c.sessions?.filter(s => s.id !== sessionId) || [];
      let newActiveId = c.activeSessionId;
      if (c.activeSessionId === sessionId) {
        newActiveId = newSessions.length > 0 ? newSessions[0].id : undefined;
      }
      return { ...c, sessions: newSessions, activeSessionId: newActiveId };
    });
  };

  const handleRenameSession = (sessionId: string, newName: string) => {
    setConfig(c => {
        if (!c) return null;
        const newSessions = c.sessions?.map(s => s.id === sessionId ? { ...s, name: newName } : s) || [];
        return { ...c, sessions: newSessions };
    });
  };

  const generateSessionName = async (session: ChatSession) => {
      if (!config) return;

      const conversation = session.messages
          .filter(m => ['user', 'assistant'].includes(m.role) && m.content)
          .slice(0, 2) // Base title on first exchange
          .map(m => {
            if (Array.isArray(m.content)) {
                const textPart = m.content.find((p): p is Extract<ChatMessageContentPart, { type: 'text' }> => p.type === 'text');
                return `${m.role}: ${textPart?.text || '[image]'}`;
            }
            return `${m.role}: ${m.content}`;
          })
          .join('\n');

      if (!conversation.trim()) {
        logger.warn(`Cannot generate session name for session ${session.id}: no conversation content found.`);
        return;
      }

      const prompt = `${SESSION_NAME_PROMPT}\n\n---\n\nConversation:\n${conversation}`;
      
      try {
          logger.info(`Generating session title for session ${session.id}`);
          const title = await generateTextCompletion(config.baseUrl, session.modelId, [{ role: 'user', content: prompt }]);
          const cleanedTitle = title.trim().replace(/^"|"$/g, '');
          if (cleanedTitle) {
            handleRenameSession(session.id, cleanedTitle);
            logger.info(`Session ${session.id} renamed to: "${cleanedTitle}"`);
          }
      } catch (e) {
          logger.error(`Failed to generate session name: ${e}`);
      }
  };

  const handleManualGenerateSessionName = (sessionId: string) => {
    const sessionToRename = sessions.find(s => s.id === sessionId);
    if (sessionToRename) {
      logger.info(`Manually triggered name generation for session: ${sessionToRename.name}`);
      generateSessionName(sessionToRename);
    } else {
      logger.warn(`Could not find session with id ${sessionId} to generate name.`);
    }
  };

  const handleSelectModel = (modelId: string) => {
    logger.info(`Model selected for new chat: ${modelId}`);
    const newSession: ChatSession = {
        id: `session_${Date.now()}`,
        name: 'New Chat',
        modelId: modelId,
        messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }],
    };
    setConfig(c => {
        if (!c) return null;
        const newSessions = [...(c.sessions || []), newSession];
        return { ...c, sessions: newSessions, activeSessionId: newSession.id };
    });
    setView('chat');
  };
  
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsResponding(false);
      logger.info('User requested to stop generation.');
    }
  };

  const handleSendMessage = async (content: string | ChatMessageContentPart[]) => {
    if (!activeSession || !config) return;

    logger.info(`Sending message to model ${activeSession.modelId}.`);
    const isFirstUserMessage = activeSession.messages.filter(m => m.role === 'user').length === 0;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage: ChatMessage = { role: 'user', content: content };
    const newMessages: ChatMessage[] = [...activeSession.messages, userMessage];
    
    const updatedSession: ChatSession = { ...activeSession, messages: [...newMessages, { role: 'assistant', content: '' }] };
    setConfig(c => ({ ...c!, sessions: c!.sessions!.map(s => s.id === activeSessionId ? updatedSession : s) }));
    setIsResponding(true);

    let messagesForApi: ChatMessage[] = [...newMessages];
    
    if (activeProjectId && window.electronAPI) {
        const activeProject = config.projects?.find(p => p.id === activeProjectId);
        if (activeProject) {
            try {
                const fileTree = await window.electronAPI.projectGetFileTree(activeProject.path);
                const contextSystemPrompt = `You are a helpful AI assistant. The user has provided context for a software project named "${activeProject.name}".\nThe project's file structure is as follows:\n\`\`\`\n${fileTree}\n\`\`\`\nAnswer the user's questions based on this project context.`;
                messagesForApi[0] = { role: 'system', content: contextSystemPrompt };
                logger.info(`Injected project context for "${activeProject.name}" into system prompt.`);
            } catch (e) {
                logger.error(`Failed to get project file tree: ${e}`);
            }
        }
    }

    await streamChatCompletion(
      config.baseUrl,
      activeSession.modelId,
      messagesForApi,
      controller.signal,
      (chunk) => {
        setConfig(c => {
            if (!c) return c;
            const targetSession = c.sessions?.find(s => s.id === activeSessionId);
            if (!targetSession) return c;
            const lastMsg = targetSession.messages[targetSession.messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
                const updatedMsg: ChatMessage = { ...lastMsg, content: (lastMsg.content as string) + chunk };
                const updatedMessages: ChatMessage[] = [...targetSession.messages.slice(0, -1), updatedMsg];
                const updatedS: ChatSession = { ...targetSession, messages: updatedMessages };
                return { ...c, sessions: c.sessions!.map(s => s.id === activeSessionId ? updatedS : s) };
            }
            return c;
        });
      },
      (err) => {
        const errorMsgContent = `Sorry, an error occurred: ${err.message}`;
        const errorMsg: ChatMessage = { role: 'assistant', content: errorMsgContent };
        setConfig(c => {
            if (!c) return c;
            const targetSession = c.sessions?.find(s => s.id === activeSessionId);
            if (!targetSession) return c;
            const updatedMessages: ChatMessage[] = [...targetSession.messages.slice(0,-1), errorMsg];
            const updatedS: ChatSession = { ...targetSession, messages: updatedMessages };
            return { ...c, sessions: c.sessions!.map(s => s.id === activeSessionId ? updatedS : s) };
        });
        setIsResponding(false);
        abortControllerRef.current = null;
      },
      () => {
        setIsResponding(false);
        abortControllerRef.current = null;
        logger.info('Message stream completed.');
        if (isFirstUserMessage && activeSessionId) {
            // Use setConfig's callback to ensure we get the final, updated state
            setConfig(currentConfig => {
                if (!currentConfig) return null;
                const finalSession = currentConfig.sessions?.find(s => s.id === activeSessionId);
                if (finalSession) {
                    // Fire-and-forget the async name generation
                    generateSessionName(finalSession);
                }
                return currentConfig; // No actual state change needed here
            });
        }
      }
    );
  };

  const handleInjectContentForChat = (filename: string, content: string) => {
    const formattedContent = `Here is the content of \`${filename}\` for context:\n\n\`\`\`\n${content}\n\`\`\`\n\nI have a question about this file.`;
    setPrefilledInput(formattedContent);
    if (!activeSession) {
        handleNewChat(); // Go to model selection if no chat is active
    }
    setView('chat');
    logger.info(`Injected content of ${filename} into chat input.`);
  };

  const onPrefillConsumed = () => {
    setPrefilledInput('');
  };
  
  const handleSaveApiPrompt = (prompt: string) => {
    setConfig(c => {
        if (!c) return null;
        const recent = c.apiRecentPrompts || [];
        const updatedRecent = [prompt, ...recent.filter(p => p !== prompt)].slice(0, 10);
        return { ...c, apiRecentPrompts: updatedRecent };
    });
    logger.info(`Saved API prompt to history.`);
  };

  const handleClearApiPrompts = () => {
      setConfig(c => c ? { ...c, apiRecentPrompts: [] } : null);
      logger.info('Cleared API prompt history.');
  };

  const handleRunProject = async (project: CodeProject) => {
    if (!window.electronAPI) return;
    setRunOutput({ title: `Running ${project.name}...`, stdout: 'Executing script...', stderr: '' });
    try {
        const result = await window.electronAPI.runProject(project);
        setRunOutput({ title: `Output for ${project.name}`, ...result });
        logger.info(`Ran project ${project.name}. Stdout: ${result.stdout.slice(0,100)}... Stderr: ${result.stderr}`);
    } catch (e) {
        const msg = `Failed to run project: ${e instanceof Error ? e.message : String(e)}`;
        logger.error(msg);
        setRunOutput({ title: `Error running ${project.name}`, stdout: '', stderr: msg });
    }
  };
  
  const handleGoToSettings = () => {
    setView('settings');
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = e.clientX;
    const minWidth = 200;
    const maxWidth = 600;
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };
  
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);


  const renderContent = () => {
    if (!config) {
        return <div className="flex items-center justify-center h-full text-[--text-muted]">Loading settings...</div>;
    }

    switch(view) {
        case 'settings':
            return <SettingsPanel 
                config={config} 
                onConfigChange={handleConfigChange} 
                isConnecting={isLoadingModels}
                isElectron={isElectron}
                theme={config.theme || 'dark'}
              />;
        case 'info':
            return <InfoView theme={config.theme || 'dark'} />;
        case 'projects':
            return <ProjectsView 
                config={config}
                onConfigChange={handleConfigChange}
                isElectron={isElectron}
                onInjectContentForChat={handleInjectContentForChat}
                onRunProject={handleRunProject}
              />;
        case 'api':
            return <ApiView
                isElectron={isElectron}
                theme={config.theme || 'dark'}
                config={config}
                models={models}
                onSaveApiPrompt={handleSaveApiPrompt}
                onClearApiPrompts={handleClearApiPrompts}
              />;
        case 'chat':
        default:
             if (activeSession) {
                 return (
                    <ChatView
                        key={activeSession.id}
                        session={activeSession}
                        onSendMessage={handleSendMessage}
                        isResponding={isResponding}
                        onStopGeneration={handleStopGeneration}
                        onRenameSession={(newName) => handleRenameSession(activeSession.id, newName)}
                        theme={config.theme || 'dark'}
                        isElectron={isElectron}
                        projects={config.projects || []}
                        predefinedInput={prefilledInput}
                        onPrefillConsumed={onPrefillConsumed}
                        activeProjectId={activeProjectId}
                        onSetActiveProject={setActiveProjectId}
                        models={models}
                        onSelectModel={handleSelectModel}
                        predefinedPrompts={config.predefinedPrompts || []}
                    />
                );
             }
             return (
                <div className="h-full overflow-y-auto bg-[--bg-secondary]">
                    <ModelSelector
                        models={models}
                        onSelectModel={handleSelectModel}
                        isLoading={isLoadingModels}
                        error={error}
                        onGoToSettings={handleGoToSettings}
                    />
                </div>
            );
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans bg-[--bg-primary]">
      {runOutput && <RunOutputModal runOutput={runOutput} onClose={() => setRunOutput(null)} />}
      <header className="flex items-center justify-between p-2 border-b border-[--border-primary] bg-[--bg-primary] sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold px-2 text-[--text-primary]">{APP_NAME}</h1>
            <nav className="flex items-center gap-1 bg-[--bg-secondary] p-1 rounded-xl">
              <NavButton active={view === 'chat'} onClick={() => setView('chat')} ariaLabel="Chat View" view="chat">
                <MessageSquareIcon className="w-5 h-5" />
                <span>Chat</span>
              </NavButton>
              <NavButton active={view === 'projects'} onClick={() => setView('projects')} ariaLabel="Projects View" view="projects">
                <CodeIcon className="w-5 h-5" />
                <span>Projects</span>
              </NavButton>
               <NavButton active={view === 'api'} onClick={() => setView('api')} ariaLabel="API Client View" view="api">
                <ServerIcon className="w-5 h-5" />
                <span>API Client</span>
              </NavButton>
              <NavButton active={view === 'settings'} onClick={() => setView('settings')} ariaLabel="Settings View" view="settings">
                 <SettingsIcon className="w-5 h-5" />
                <span>Settings</span>
              </NavButton>
              <NavButton active={view === 'info'} onClick={() => setView('info')} ariaLabel="Info View" view="info">
                <InfoIcon className="w-5 h-5" />
                <span>Info</span>
              </NavButton>
            </nav>
        </div>

        <div className="flex items-center gap-2 pr-2">
           <button
            onClick={() => setIsLogPanelVisible(!isLogPanelVisible)}
            className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus]"
            aria-label="Toggle logs panel"
            >
             <FileTextIcon className="w-5 h-5" />
            </button>
          <ThemeSwitcher theme={config?.theme || 'dark'} onToggle={handleThemeToggle} />
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {view === 'chat' && activeSession && (
          <>
            <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 h-full">
              <SessionSidebar
                sessions={sessions}
                activeSessionId={activeSessionId || null}
                onNewChat={handleNewChat}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onGenerateSessionName={handleManualGenerateSessionName}
              />
            </div>
            <div
              onMouseDown={handleResizeMouseDown}
              className="w-1.5 flex-shrink-0 cursor-col-resize bg-[--bg-tertiary] hover:bg-[--border-focus] transition-colors duration-200"
              aria-label="Resize sidebar"
              role="separator"
            ></div>
          </>
        )}
        <div className="flex-1 overflow-hidden">
            {renderContent()}
        </div>
      </main>
      {isLogPanelVisible && <LoggingPanel onClose={() => setIsLogPanelVisible(false)} />}
    </div>
  );
};

export default App;
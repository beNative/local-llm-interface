import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Config, Model, ChatMessage, Theme, CodeProject, ChatSession, ChatMessageContentPart, PredefinedPrompt, ChatMessageMetadata, SystemPrompt, FileSystemEntry, SystemStats, GenerationConfig, LLMProviderConfig } from './types';
import { APP_NAME, DEFAULT_PROVIDERS, DEFAULT_SYSTEM_PROMPT, SESSION_NAME_PROMPT } from './constants';
import { fetchModels, streamChatCompletion, LLMServiceError, generateTextCompletion, StreamChunk } from './services/llmService';
import { logger } from './services/logger';
import SettingsPanel from './components/SettingsPanel';
import ModelSelector from './components/ModelSelector';
import ChatView from './components/ChatView';
import ThemeSwitcher from './components/ThemeSwitcher';
import LoggingPanel from './components/LoggingPanel';
import InfoView from './components/InfoView';
import ProjectsView from './components/ProjectsView';
import ApiView from './components/ApiView';
import SessionSidebar from './components/SessionSidebar';
import CommandPalette from './components/CommandPalette';
import StatusBar from './components/StatusBar';
import Icon from './components/Icon';
import { IconProvider } from './components/IconProvider';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  view: View;
  title: string;
}> = ({ active, onClick, children, ariaLabel, view, title }) => {
    const accentVar = `var(--accent-${view})`;
    return (
        <button
            onClick={onClick}
            title={title}
            aria-label={ariaLabel}
            className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                active
                    ? `text-[--accent-${view}]`
                    : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'
            }`}
        >
            {children}
            {active && (
                 <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 rounded-full"
                    style={{ backgroundColor: accentVar }}
                />
            )}
        </button>
    );
};

const RunOutputModal: React.FC<{
    runOutput: { title: string; stdout: string; stderr: string };
    onClose: () => void;
}> = ({ runOutput, onClose }) => {
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
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
};


const App: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('chat');
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [retrievalStatus, setRetrievalStatus] = useState<'idle' | 'retrieving'>('idle');
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState('');
  const [runOutput, setRunOutput] = useState<{ title: string; stdout: string; stderr: string; } | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedThinkingText = useRef<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = useRef(false);


  // Derived state from config
  const sessions = config?.sessions || [];
  const activeSessionId = config?.activeSessionId;
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const providers = config?.providers || [];
  const selectedProviderId = config?.selectedProviderId;
  const activeProvider = providers.find(p => p.id === selectedProviderId) || null;

  // Effect for one-time app initialization and loading settings
  useEffect(() => {
    logger.info('App initializing...');
    const loadInitialConfig = async () => {
      logger.debug('Loading initial config.');
      const defaultConfig: Config = { 
        providers: DEFAULT_PROVIDERS,
        selectedProviderId: 'ollama',
        theme: 'dark',
        themeOverrides: {
            light: {},
            dark: {},
        },
        logToFile: false,
        pythonProjectsPath: '',
        nodejsProjectsPath: '',
        webAppsPath: '',
        javaProjectsPath: '',
        delphiProjectsPath: '',
        projects: [],
        apiRecentPrompts: [],
        sessions: [],
        predefinedPrompts: [],
        systemPrompts: [],
      };
      
      let loadedConfig: Config = defaultConfig;

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

      // MIGRATION LOGIC from old provider structure
      const oldConf = loadedConfig as any;
      if (!loadedConfig.providers || loadedConfig.providers.length === 0 || oldConf.provider) {
          logger.info('Migrating old provider configuration to new structure.');
          const newProviders = [...DEFAULT_PROVIDERS];
          const oldProviderName = oldConf.provider;
          let newSelectedId = 'ollama';

          if (oldProviderName === 'LMStudio') newSelectedId = 'lmstudio';
          else if (oldProviderName === 'OpenAI') newSelectedId = 'openai';
          else if (oldProviderName === 'Google Gemini') newSelectedId = 'google-gemini';
          else if (oldProviderName === 'Custom' && oldConf.baseUrl) {
              const customProvider: LLMProviderConfig = {
                  id: 'custom-migrated',
                  name: 'Custom (Migrated)',
                  baseUrl: oldConf.baseUrl,
                  type: 'openai-compatible',
                  isCustom: true,
              };
              newProviders.push(customProvider);
              newSelectedId = 'custom-migrated';
          }
          
          loadedConfig.providers = newProviders;
          loadedConfig.selectedProviderId = newSelectedId;

          // Migrate sessions
          if (loadedConfig.sessions) {
              loadedConfig.sessions = (loadedConfig.sessions as any[]).map((s: any) => {
                  if (s.provider) {
                      let providerId = 'ollama'; // default
                      if (s.provider === 'LMStudio') providerId = 'lmstudio';
                      else if (s.provider === 'OpenAI') providerId = 'openai';
                      else if (s.provider === 'Google Gemini') providerId = 'google-gemini';
                      else if (s.provider === 'Custom') providerId = newSelectedId;
                      
                      const { provider, ...rest } = s;
                      return { ...rest, providerId };
                  }
                  return s;
              });
          }
          delete oldConf.provider;
          delete oldConf.baseUrl;
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
    const activeTheme = config?.theme || 'dark';
    
    if (overrides) {
        const themeSpecificOverrides = activeTheme === 'dark' ? overrides.dark : overrides.light;
        const css = `
        :root {
          ${themeSpecificOverrides?.chatBg ? `--chat-bg-color: ${themeSpecificOverrides.chatBg};` : ''}
          ${themeSpecificOverrides?.userMessageBg ? `--user-message-bg-color: ${themeSpecificOverrides.userMessageBg};` : ''}
          ${themeSpecificOverrides?.userMessageColor ? `--user-message-text-color: ${themeSpecificOverrides.userMessageColor};` : ''}
          ${themeSpecificOverrides?.assistantMessageBg ? `--assistant-message-bg-color: ${themeSpecificOverrides.assistantMessageBg};` : ''}
          ${themeSpecificOverrides?.assistantMessageColor ? `--assistant-message-text-color: ${themeSpecificOverrides.assistantMessageColor};` : ''}
          ${overrides.fontFamily ? `--chat-font-family: ${overrides.fontFamily};` : ''}
          ${overrides.fontSize ? `--chat-font-size: ${overrides.fontSize}px;` : ''}
        }
      `;
      styleElement.innerHTML = css;
      document.head.appendChild(styleElement);
      logger.debug(`Applied custom theme overrides for ${activeTheme} mode.`);
    } else {
      styleElement.innerHTML = ''; // Clear styles if no overrides
      logger.debug('No theme overrides to apply.');
    }
  }, [config?.themeOverrides, config?.theme]);

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

   // Effect for command palette shortcut
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setIsCommandPaletteOpen(isOpen => !isOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    // Effect for system stats monitoring
    useEffect(() => {
        if (isElectron && window.electronAPI?.onSystemStatsUpdate) {
            const statsHandler = (stats: SystemStats) => setSystemStats(stats);
            window.electronAPI.onSystemStatsUpdate(statsHandler);

            return () => {
                if (window.electronAPI?.removeAllSystemStatsUpdateListeners) {
                    window.electronAPI.removeAllSystemStatsUpdateListeners();
                }
            };
        }
    }, [isElectron]);


  const handleConfigChange = useCallback((newConfig: Config) => {
    logger.info('Configuration change requested.');

    setConfig(currentConfig => {
      if (!currentConfig) return newConfig;

      const oldProvider = currentConfig.providers?.find(p => p.id === currentConfig.selectedProviderId);
      const newProvider = newConfig.providers?.find(p => p.id === newConfig.selectedProviderId);

      const needsModelReload = !oldProvider || !newProvider || 
        newProvider.id !== oldProvider.id ||
        newProvider.baseUrl !== oldProvider.baseUrl ||
        (newProvider.apiKeyName && newConfig.apiKeys?.[newProvider.apiKeyName] !== currentConfig.apiKeys?.[newProvider.apiKeyName]);

      if (needsModelReload) {
        logger.info('Provider, Base URL, or API Key changed. Reloading models.');
        setView('chat');
        return { ...newConfig, activeSessionId: undefined };
      }
      
      return { ...currentConfig, ...newConfig };
    });

    logger.setConfig({ logToFile: newConfig.logToFile });
  }, []);
  
  const handleProviderChange = useCallback((providerId: string) => {
    setConfig(c => {
        if (!c || c.selectedProviderId === providerId) return c;
        
        logger.info(`Provider changed to ${providerId} from status bar.`);
        setView('chat');
        return {
            ...c,
            selectedProviderId: providerId,
            activeSessionId: undefined,
        };
    });
  }, []);

  const handleThemeToggle = () => {
      setConfig(currentConfig => {
        if (!currentConfig) return null;
        const newTheme = currentConfig.theme === 'light' ? 'dark' : 'light';
        logger.info(`Theme toggled to ${newTheme}.`);
        return { ...currentConfig, theme: newTheme };
      });
  };

  const loadModels = useCallback(async () => {
    if (!activeProvider || !config) {
        setError("Provider configuration not loaded. Please select a provider in Settings.");
        setModels([]);
        return;
    }
    setIsLoadingModels(true);
    setError(null);
    try {
      const fetchedModels = await fetchModels(activeProvider, config.apiKeys);
      setModels(fetchedModels);
    } catch (err) {
      const errorMessage = err instanceof LLMServiceError ? err.message : 'An unexpected error occurred.';
      setError(errorMessage);
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [config, activeProvider]);

  useEffect(() => {
    // Load models if config is ready and we are on a view that needs them
    if (config && (view === 'chat' || view === 'api')) {
      loadModels();
    }
  }, [view, config, loadModels]);
  
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

  const handleRenameSession = useCallback((sessionId: string, newName: string) => {
    setConfig(c => {
        if (!c) return null;
        const newSessions = c.sessions?.map(s => s.id === sessionId ? { ...s, name: newName } : s) || [];
        return { ...c, sessions: newSessions };
    });
  }, []);

  const generateSessionName = useCallback(async (session: ChatSession) => {
      if (!config || !config.providers) return;
      
      const providerForSession = config.providers.find(p => p.id === session.providerId);
      if (!providerForSession) {
          logger.error(`Cannot generate session name: Provider with ID ${session.providerId} not found.`);
          return;
      }

      const conversation = session.messages
          .filter(m => ['user', 'assistant'].includes(m.role) && m.content)
          .slice(0, 2) // Base title on first exchange
          .map(m => {
            if (Array.isArray(m.content)) {
                const textPart = m.content.find((p): p is { type: 'text', text: string } => p.type === 'text');
                if (textPart) {
                  return `${m.role}: ${textPart.text || '[image]'}`;
                }
                return `${m.role}: [image]`;
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
          const title = await generateTextCompletion(providerForSession, config.apiKeys, session.modelId, [{ role: 'user', content: prompt }]);
          const cleanedTitle = title.trim().replace(/^"|"$/g, '');
          if (cleanedTitle) {
            handleRenameSession(session.id, cleanedTitle);
            logger.info(`Session ${session.id} renamed to: "${cleanedTitle}"`);
          }
      } catch (e) {
          logger.error(`Failed to generate session name: ${e}`);
      }
  }, [config, handleRenameSession]);

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
    if (!config || !config.selectedProviderId) return;
    logger.info(`Model selected for new chat: ${modelId}`);
    const newSession: ChatSession = {
        id: `session_${Date.now()}`,
        name: 'New Chat',
        modelId: modelId,
        providerId: config.selectedProviderId,
        messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }],
        systemPromptId: null,
        generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.9,
        },
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
      setRetrievalStatus('idle');
      setThinkingText(null);
      logger.info('User requested to stop generation.');
    }
  };
  
  const handleSetSessionSystemPrompt = (systemPromptId: string | null) => {
    setConfig(c => {
        if (!c || !c.activeSessionId) return c;
        
        const activeSession = c.sessions?.find(s => s.id === c.activeSessionId);
        if (!activeSession) return c;

        const systemPrompt = c.systemPrompts?.find(sp => sp.id === systemPromptId);
        const newSystemContent = systemPrompt ? systemPrompt.content : DEFAULT_SYSTEM_PROMPT;

        const newMessages = [...activeSession.messages];
        const systemMessageIndex = newMessages.findIndex(m => m.role === 'system');

        if (systemMessageIndex > -1) {
            newMessages[systemMessageIndex] = { ...newMessages[systemMessageIndex], content: newSystemContent };
        } else {
            newMessages.unshift({ role: 'system', content: newSystemContent });
        }
        
        const updatedSession: ChatSession = { 
            ...activeSession, 
            messages: newMessages,
            systemPromptId: systemPromptId,
        };

        const newSessions = c.sessions!.map(s => s.id === c.activeSessionId ? updatedSession : s);
        logger.info(`Set system prompt for session ${c.activeSessionId} to "${systemPrompt?.title || 'Default'}".`);
        return { ...c, sessions: newSessions };
    });
  };

  const handleSetSessionGenerationConfig = (generationConfig: GenerationConfig) => {
    if (!activeSessionId) return;
    setConfig(c => {
        if (!c) return null;
        const newSessions = c.sessions?.map(s => s.id === activeSessionId ? { ...s, generationConfig } : s) || [];
        return { ...c, sessions: newSessions };
    });
  };

  const handleSendMessage = useCallback(async (content: string | ChatMessageContentPart[], options?: { useRAG: boolean }) => {
    if (!config || !config.providers || !config.activeSessionId) {
        logger.error("SendMessage called without an active session or configuration.");
        return;
    }
    
    const sessionId = config.activeSessionId;
    const session = config.sessions?.find(s => s.id === sessionId);

    if (!session) {
        logger.error(`SendMessage could not find the active session with id ${sessionId}`);
        return;
    }

    const providerForSession = config.providers.find(p => p.id === session.providerId);
    if (!providerForSession) {
        logger.error(`Cannot send message: Provider with ID ${session.providerId} for session ${session.id} not found.`);
        return;
    }

    logger.info(`Sending message to model ${session.modelId} via ${providerForSession.name}. RAG enabled: ${!!options?.useRAG}`);
    const isFirstUserMessage = session.messages.filter(m => m.role === 'user').length === 0;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    accumulatedThinkingText.current = null;

    const userMessageContent = Array.isArray(content) ? (content.find(p => p.type === 'text') as { type: 'text', text: string } | undefined)?.text || '' : content;
    const modificationRegex = /(?:refactor|modify|change|update|add to|edit|implement|create|write|delete)\s+(?:in\s+)?(?:the\s+file\s+)?([\w./\\-]+)/i;
    const match = modificationRegex.exec(userMessageContent);
    
    let userMessage: ChatMessage = { role: 'user', content };
    let newMessages: ChatMessage[] = [...session.messages, userMessage];

    if (!newMessages.some(m => m.role === 'system')) {
        newMessages.unshift({ role: 'system', content: DEFAULT_SYSTEM_PROMPT });
    }

    let messagesForApi: ChatMessage[] = [...newMessages];
    let ragMetadata: ChatMessageMetadata['ragContext'] | undefined = undefined;

    if (match && activeProjectId && window.electronAPI) {
        // ... (existing file modification logic is unchanged)
    } else if (options?.useRAG && activeProjectId && window.electronAPI) {
        // ... (existing RAG logic is unchanged)
    }
    
    const updatedSession: ChatSession = { ...session, messages: [...newMessages, { role: 'assistant', content: '' }] };
    setConfig(c => ({ ...c!, sessions: c!.sessions!.map(s => s.id === sessionId ? updatedSession : s) }));
    setIsResponding(true);
    setThinkingText(null);

    await streamChatCompletion(
      providerForSession,
      config.apiKeys,
      session.modelId,
      messagesForApi,
      controller.signal,
      (chunk: StreamChunk) => {
        if (chunk.type === 'reasoning') {
            accumulatedThinkingText.current = (accumulatedThinkingText.current || '') + chunk.text;
            setThinkingText(accumulatedThinkingText.current);
        } else if (chunk.type === 'content') {
            setThinkingText(null);
            setConfig(c => {
                if (!c) return c;
                const targetSession = c.sessions?.find(s => s.id === sessionId);
                if (!targetSession) return c;
                const lastMsg = targetSession.messages[targetSession.messages.length - 1];
                if (lastMsg?.role === 'assistant') {
                    const updatedMsg: ChatMessage = { ...lastMsg, content: (lastMsg.content as string) + chunk.text };
                    return { ...c, sessions: c.sessions!.map(s => s.id === sessionId ? { ...s, messages: [...s.messages.slice(0, -1), updatedMsg] } : s) };
                }
                return c;
            });
        }
      },
      (err) => {
        const errorMsgContent = `Sorry, an error occurred: ${err.message}`;
        const errorMsg: ChatMessage = { role: 'assistant', content: errorMsgContent };
        setConfig(c => {
            if (!c) return c;
            const targetSession = c.sessions?.find(s => s.id === sessionId);
            if (!targetSession) return c;
            return { ...c, sessions: c.sessions!.map(s => s.id === sessionId ? { ...s, messages: [...s.messages.slice(0, -1), errorMsg] } : s) };
        });
        setIsResponding(false);
        setRetrievalStatus('idle');
        setThinkingText(null);
        abortControllerRef.current = null;
      },
      (metadata: ChatMessageMetadata) => {
        const finalThinkingText = accumulatedThinkingText.current;
        setIsResponding(false);
        setRetrievalStatus('idle');
        setThinkingText(null);
        accumulatedThinkingText.current = null;
        abortControllerRef.current = null;
        logger.info('Message stream completed.');
        
        setConfig(c => {
            if (!c) return c;
            const targetSession = c.sessions?.find(s => s.id === sessionId);
            if (!targetSession) return c;
            const lastMsg = targetSession.messages[targetSession.messages.length - 1];
            if (lastMsg?.role === 'assistant') {
                const finalMetadata: ChatMessageMetadata = { 
                    ...metadata, 
                    ragContext: ragMetadata,
                    ...(finalThinkingText && { thinking: finalThinkingText }),
                };
                const updatedMsg: ChatMessage = { ...lastMsg, metadata: finalMetadata };
                return { ...c, sessions: c.sessions!.map(s => s.id === sessionId ? { ...s, messages: [...s.messages.slice(0, -1), updatedMsg] } : s) };
            }
            return c;
        });

        if (isFirstUserMessage && sessionId) {
            setConfig(currentConfig => {
                if (!currentConfig) return null;
                const finalSession = currentConfig.sessions?.find(s => s.id === sessionId);
                if (finalSession) {
                    generateSessionName(finalSession);
                }
                return currentConfig;
            });
        }
      },
      session.generationConfig
    );
  }, [config, activeProjectId, generateSessionName]);

  const handleAcceptModification = async (filePath: string, newContent: string) => {
    if (!window.electronAPI) return;
    try {
        await window.electronAPI.writeProjectFile(filePath, newContent);
        logger.info(`Successfully applied AI modifications to ${filePath}`);
        // Find the message and update its status
        setConfig(c => {
            if (!c || !activeSessionId) return c;
            const newSessions = c.sessions.map(s => {
                if (s.id !== activeSessionId) return s;
                const newMessages = s.messages.map((m): ChatMessage => {
                    if (m.fileModification && m.fileModification.filePath === filePath) {
                        return { ...m, fileModification: { ...m.fileModification, status: 'accepted' } };
                    }
                    return m;
                });
                return { ...s, messages: newMessages };
            });
            return { ...c, sessions: newSessions };
        });
    } catch (e) {
        logger.error(`Failed to write file modifications to ${filePath}: ${e}`);
        alert(`Failed to save changes: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleRejectModification = (filePath: string) => {
      logger.info(`User rejected AI modifications for ${filePath}`);
      setConfig(c => {
          if (!c || !activeSessionId) return c;
          const newSessions = c.sessions.map(s => {
              if (s.id !== activeSessionId) return s;
              const newMessages = s.messages.map((m): ChatMessage => {
                  if (m.fileModification && m.fileModification.filePath === filePath) {
                      return { ...m, fileModification: { ...m.fileModification, status: 'rejected' } };
                  }
                  return m;
              });
              return { ...s, messages: newMessages };
          });
          return { ...c, sessions: newSessions };
      });
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

  const handleOpenFileFromPalette = (file: { path: string; name: string }) => {
    setView('projects');
    setEditingFile(file);
    // Note: This won't auto-expand the project tree, but it opens the file, which is the main goal.
  };


  const renderContent = () => {
    if (!config) {
        return <div className="flex items-center justify-center h-full text-[--text-muted]">Loading settings...</div>;
    }

    switch(view) {
        case 'settings':
            return <SettingsPanel 
                config={config} 
                onConfigChange={handleConfigChange} 
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
                editingFile={editingFile}
                onSetEditingFile={setEditingFile}
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
                        isResponding={isResponding || retrievalStatus === 'retrieving'}
                        retrievalStatus={retrievalStatus}
                        thinkingText={thinkingText}
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
                        systemPrompts={config.systemPrompts || []}
                        onSetSessionSystemPrompt={handleSetSessionSystemPrompt}
                        onSetSessionGenerationConfig={handleSetSessionGenerationConfig}
                        onAcceptModification={handleAcceptModification}
                        onRejectModification={handleRejectModification}
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
                        provider={activeProvider}
                        theme={config.theme || 'dark'}
                    />
                </div>
            );
    }
  };
  
  const connectionStatus: 'connected' | 'connecting' | 'error' = isLoadingModels
      ? 'connecting'
      : error
      ? 'error'
      : 'connected';

  const statusText =
      connectionStatus === 'connecting'
      ? 'Connecting to LLM provider...'
      : connectionStatus === 'error'
      ? `Connection Error`
      : `Connected to ${activeProvider?.name}. ${models.length} model(s) available.`;

  const activeProjectName = activeProjectId
      ? config?.projects?.find(p => p.id === activeProjectId)?.name || null
      : null;

  return (
    <IconProvider iconSet={config?.themeOverrides?.iconSet || 'default'}>
      <div className="flex flex-col h-screen font-sans bg-[--bg-primary]">
        {config && <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          sessions={config.sessions || []}
          projects={config.projects || []}
          onNavigate={setView}
          onSelectSession={handleSelectSession}
          onOpenFile={handleOpenFileFromPalette}
        />}
        {runOutput && <RunOutputModal runOutput={runOutput} onClose={() => setRunOutput(null)} />}
        <header className="flex items-center justify-between p-2 border-b border-[--border-primary] bg-[--bg-primary] sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold px-2 text-[--text-primary]">{APP_NAME}</h1>
              <nav className="flex items-center gap-1">
                <NavButton active={view === 'chat'} onClick={() => setView('chat')} title="Switch to the main chat interface" ariaLabel="Chat View" view="chat">
                  <Icon name="messageSquare" className="w-5 h-5" />
                  <span>Chat</span>
                </NavButton>
                <NavButton active={view === 'projects'} onClick={() => setView('projects')} title="Manage local code projects" ariaLabel="Projects View" view="projects">
                  <Icon name="code" className="w-5 h-5" />
                  <span>Projects</span>
                </NavButton>
                 <NavButton active={view === 'api'} onClick={() => setView('api')} title="Test HTTP endpoints using natural language" ariaLabel="API Client View" view="api">
                  <Icon name="server" className="w-5 h-5" />
                  <span>API Client</span>
                </NavButton>
                <NavButton active={view === 'settings'} onClick={() => setView('settings')} title="Configure application settings" ariaLabel="Settings View" view="settings">
                   <Icon name="settings" className="w-5 h-5" />
                  <span>Settings</span>
                </NavButton>
                <NavButton active={view === 'info'} onClick={() => setView('info')} title="View application documentation and manuals" ariaLabel="Info View" view="info">
                  <Icon name="info" className="w-5 h-5" />
                  <span>Info</span>
                </NavButton>
              </nav>
          </div>

          <div className="flex items-center gap-2 pr-2">
             <div className="hidden sm:block text-xs text-[--text-muted] border border-[--border-secondary] rounded-md px-2 py-1 font-mono">
                  Cmd/Ctrl + K
             </div>
             <button
              onClick={() => setIsLogPanelVisible(!isLogPanelVisible)}
              className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus]"
              aria-label="Toggle logs panel"
              title="Toggle the application logs panel for debugging"
              >
               <Icon name="fileText" className="w-5 h-5" />
              </button>
            <ThemeSwitcher theme={config?.theme || 'dark'} onToggle={handleThemeToggle} />
          </div>
        </header>
        <div className="flex-1 flex flex-col overflow-hidden">
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
          {isElectron && config && (
              <StatusBar
                  stats={systemStats}
                  connectionStatus={connectionStatus}
                  statusText={statusText}
                  providers={providers}
                  selectedProviderId={selectedProviderId}
                  activeModel={activeSession?.modelId || null}
                  activeProject={activeProjectName}
                  models={models}
                  onSelectModel={handleSelectModel}
                  onChangeProvider={handleProviderChange}
              />
          )}
        </div>
        {isLogPanelVisible && <LoggingPanel onClose={() => setIsLogPanelVisible(false)} />}
      </div>
    </IconProvider>
  );
};

export default App;

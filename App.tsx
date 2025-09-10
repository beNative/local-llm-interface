import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Config, Model, ChatMessage, Theme, CodeProject, ChatSession, ChatMessageContentPart, PredefinedPrompt, ChatMessageMetadata, SystemPrompt, FileSystemEntry, SystemStats, GenerationConfig, LLMProviderConfig, Tool, ToolCall, AssistantToolCallMessage, ToolResponseMessage, StandardChatMessage, ChatMessageContentPartText } from './types';
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
import AboutModal from './components/AboutModal';
import SessionSidebar from './components/SessionSidebar';
import CommandPalette from './components/CommandPalette';
import StatusBar from './components/StatusBar';
import Icon from './components/Icon';
import { IconProvider } from './components/IconProvider';
import { TooltipProvider } from './components/TooltipProvider';
import ToolCallApprovalModal from './components/ToolCallApprovalModal';
import { runPythonCode } from './services/pyodideService';
import { ToastProvider } from './components/ToastProvider';
import { useToast } from './hooks/useToast';

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
            className={`relative flex items-center gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium rounded-lg transition-colors duration-200 ${
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

const AppContent: React.FC = () => {
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
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[] | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedThinkingText = useRef<string | null>(null);
  const streamBuffer = useRef<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizingRef = useRef(false);
  const inThinkBlockRef = useRef<boolean>(false);
  const { addToast } = useToast();


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
            scale: 100,
            density: 'normal',
        },
        logToFile: false,
        allowPrerelease: false,
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
        window.electronAPI.getVersion().then(setAppVersion);
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
          let newSelectedId = 'ollama';

          if (oldConf.provider === 'LMStudio') newSelectedId = 'lmstudio';
          else if (oldConf.provider === 'OpenAI') newSelectedId = 'openai';
          else if (oldConf.provider === 'Google Gemini') newSelectedId = 'google-gemini';
          else if (oldConf.provider === 'Custom' && oldConf.baseUrl) {
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
          delete oldConf.provider;
          delete oldConf.baseUrl;
      }
      
      // SESSION SANITIZATION & MIGRATION
      if (loadedConfig.sessions) {
          let migratedCount = 0;
          loadedConfig.sessions = (loadedConfig.sessions as any[]).map((s: any): ChatSession => {
              let needsMigration = false;
              let migratedSession = { ...s };

              // Case 1: Old session with `provider` field
              if (s.provider && !s.providerId) {
                  let providerId = 'ollama'; // default
                  if (s.provider === 'LMStudio') providerId = 'lmstudio';
                  else if (s.provider === 'OpenAI') providerId = 'openai';
                  else if (s.provider === 'Google Gemini') providerId = 'google-gemini';
                  else if (s.provider === 'Custom') providerId = loadedConfig.selectedProviderId || 'custom-migrated';
                  
                  migratedSession.providerId = providerId;
                  delete migratedSession.provider;
                  needsMigration = true;
              }
              
              // Case 2: Session somehow missing providerId (orphan)
              if (!migratedSession.providerId) {
                  migratedSession.providerId = loadedConfig.selectedProviderId || 'ollama';
                  needsMigration = true;
                  logger.warn(`Session "${s.name}" (${s.id}) was missing a providerId. Assigned fallback: ${migratedSession.providerId}`);
              }
              
              // Case 3: Add projectId if missing
              if (s.projectId === undefined) {
                  migratedSession.projectId = null;
                  needsMigration = true;
              }

              if (needsMigration) {
                  migratedCount++;
              }
              return migratedSession as ChatSession;
          });

          if (migratedCount > 0) {
              logger.info(`Sanitized/migrated ${migratedCount} sessions to include a valid providerId.`);
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

  // Effect to apply application scale (zoom).
  useEffect(() => {
    const scale = config?.themeOverrides?.scale || 100;
    // FIX: Cast style to `any` to set the non-standard but widely supported `zoom` property.
    (document.documentElement.style as any).zoom = `${scale / 100}`;
    logger.debug(`Application scale set to: ${scale}%`);
  }, [config?.themeOverrides?.scale]);

  // Effect to apply control density.
  useEffect(() => {
      const density = config?.themeOverrides?.density || 'normal';
      document.documentElement.setAttribute('data-density', density);
      logger.debug(`Application density set to: ${density}`);
  }, [config?.themeOverrides?.density]);

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
        if (isElectron && window.electronAPI) {
            const statsHandler = (stats: SystemStats) => setSystemStats(stats);
            window.electronAPI.onSystemStatsUpdate(statsHandler);

            return () => {
                window.electronAPI?.removeSystemStatsUpdateListener();
            };
        }
    }, [isElectron]);

    // Effect for handling app updates
    useEffect(() => {
        if (isElectron && window.electronAPI) {
            const handleUpdateAvailable = (info: any) => {
                addToast({ type: 'info', message: `New version ${info.version} found. Downloading...`, duration: 5000 });
            };
            const handleUpdateDownloaded = (info: any) => {
                addToast({
                    type: 'success',
                    message: `Update ${info.version} is ready to install.`,
                    action: {
                        label: 'Restart & Install',
                        onClick: () => window.electronAPI!.quitAndInstallUpdate(),
                    }
                });
            };
            const handleUpdateError = (error: Error) => {
                 addToast({ type: 'error', message: `Update failed: ${error.message}` });
            };
            const handleUpdateNotAvailable = (info: any) => {
                 addToast({ type: 'success', message: 'You are on the latest version.', duration: 3000 });
            };

            window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
            window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
            window.electronAPI.onUpdateError(handleUpdateError);
            window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);

            return () => {
                window.electronAPI!.removeUpdateAvailableListener();
                window.electronAPI!.removeUpdateDownloadedListener();
                window.electronAPI!.removeUpdateErrorListener();
                window.electronAPI!.removeUpdateNotAvailableListener();
            }
        }
    }, [isElectron, addToast]);


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

  const appendToLastMessage = useCallback((sessionId: string, contentChunk: string) => {
    setConfig(c => {
        if (!c) return c;
        const newSessions = (c.sessions || []).map(session => {
            if (session.id !== sessionId || session.messages.length === 0) {
                return session;
            }

            const lastMsgIndex = session.messages.length - 1;
            const lastMsg = session.messages[lastMsgIndex];
            
            if (lastMsg.role === 'tool') {
                return session;
            }

            const newMessages = [...session.messages];
            const msgToUpdate = { ...newMessages[lastMsgIndex] };

            if (typeof msgToUpdate.content === 'string' || !msgToUpdate.content) {
                msgToUpdate.content = (msgToUpdate.content || '') + contentChunk;
            } else if (Array.isArray(msgToUpdate.content)) {
                let appended = false;
                for (let i = msgToUpdate.content.length - 1; i >= 0; i--) {
                    const part = msgToUpdate.content[i];
                    if (part.type === 'text') {
                        part.text += contentChunk;
                        appended = true;
                        break;
                    }
                }
                if (!appended) {
                    msgToUpdate.content.push({ type: 'text', text: contentChunk });
                }
            }
            
            newMessages[lastMsgIndex] = msgToUpdate as ChatMessage;

            return { ...session, messages: newMessages };
        });

        return { ...c, sessions: newSessions };
    });
  }, []);

  const updateSessionMessages = useCallback((sessionId: string, messages: ChatMessage[]) => {
      setConfig(c => {
          if (!c) return c;
          return {
              ...c,
              sessions: c.sessions!.map(s => s.id === sessionId ? { ...s, messages } : s)
          };
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
          // FIX: Safely handle complex ChatMessage content by checking type and extracting text.
          .map(m => {
            let contentString = '';
            if (typeof m.content === 'string') {
                contentString = m.content;
            } else if (Array.isArray(m.content)) {
                // Find the first text part and use its content.
                const textPart = m.content.find((p): p is ChatMessageContentPartText => p.type === 'text');
                contentString = textPart ? textPart.text : '[image]';
            }
            return `${m.role}: ${contentString}`;
          })
          .join('\n');

      if (!conversation.trim()) {
        logger.warn(`Cannot generate session name for session ${session.id}: no conversation content found.`);
        return;
      }

      const prompt = `${SESSION_NAME_PROMPT}\n\n---\n\nConversation:\n${conversation}`;
      
      try {
          logger.info(`Generating session title for session ${session.id}`);
          const messagesForCompletion: ChatMessage[] = [{ role: 'user', content: prompt }];
          const title = await generateTextCompletion(providerForSession, config.apiKeys, session.modelId, messagesForCompletion);
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
        projectId: null,
        agentToolsEnabled: true,
    };
    setConfig(c => {
        if (!c) return null;
        const newSessions = [...(c.sessions || []), newSession];
        return { ...c, sessions: newSessions, activeSessionId: newSession.id };
    });
    setView('chat');
  };

  const handleNewChatWithProject = (projectId: string) => {
    if (!config || !config.selectedProviderId || models.length === 0) return;
    const project = config.projects?.find(p => p.id === projectId);
    if (!project) return;

    logger.info(`Creating new chat with context from project: ${project.name}`);
    const newSession: ChatSession = {
        id: `session_${Date.now()}`,
        name: `Chat about ${project.name}`,
        modelId: models[0].id, // Default to first available model
        providerId: config.selectedProviderId,
        messages: [{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }],
        systemPromptId: null,
        generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.9,
        },
        projectId: projectId,
        agentToolsEnabled: true, // Enable by default for project chats
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
      setPendingToolCalls(null);
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
            newMessages[systemMessageIndex] = { role: 'system', content: newSystemContent };
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
  
  const handleSetSessionAgentToolsEnabled = (enabled: boolean) => {
    if (!activeSessionId) return;
    setConfig(c => {
        if (!c) return null;
        const newSessions = c.sessions?.map(s => s.id === activeSessionId ? { ...s, agentToolsEnabled: enabled } : s) || [];
        return { ...c, sessions: newSessions };
    });
  };

  const executeToolCall = async (toolCall: ToolCall, project: CodeProject | null): Promise<any> => {
      const { name, arguments: argsStr } = toolCall.function;
      logger.info(`Executing tool: ${name} with args: ${argsStr}`);
      const args = JSON.parse(argsStr);

      try {
          switch(name) {
              case 'executePython':
                  if (!window.electronAPI) throw new Error("Code interpreter is only available in the desktop app.");
                  return await window.electronAPI.runPython(args.code);
              case 'listFiles':
                  if (!project) throw new Error("No active project. Cannot list files.");
                  return await window.electronAPI!.projectListFilesRecursive(project.path);
              case 'readFile': {
                  if (!project) throw new Error("No active project. Cannot read file.");
                  const fullPath = await window.electronAPI!.projectFindFile({ projectPath: project.path, fileName: args.path });
                  if (!fullPath) throw new Error(`File not found: ${args.path}`);
                  return await window.electronAPI!.readProjectFile(fullPath);
              }
              case 'writeFile': {
                  if (!project) throw new Error("No active project. Cannot write file.");
                  // The approval flow needs the original content for a diff. We must read it *before* writing.
                  const fullPath = await window.electronAPI!.projectFindFile({ projectPath: project.path, fileName: args.path }) || `${project.path}/${args.path}`;
                  let originalContent = null;
                  try {
                    originalContent = await window.electronAPI!.readProjectFile(fullPath);
                  } catch (e) {
                    // File doesn't exist, which is fine for writeFile.
                  }
                  await window.electronAPI!.writeProjectFile(fullPath, args.content);
                  return { success: true, originalContent };
              }
              case 'runTerminalCommand': {
                  if (!project) throw new Error("No active project. Cannot run terminal command.");
                  const { stdout, stderr } = await window.electronAPI!.projectRunCommand({ projectPath: project.path, command: args.command });
                  return { stdout, stderr };
              }
              default:
                  return `Error: Tool "${name}" not found.`;
          }
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          logger.error(`Tool execution failed for ${name}: ${errorMsg}`);
          return `Error executing tool ${name}: ${errorMsg}`;
      }
  };

  const processConversationTurn = useCallback(async (sessionId: string, messages: ChatMessage[]) => {
      if (!config) return;

      const session = config.sessions?.find(s => s.id === sessionId);
      const providerForSession = config.providers?.find(p => p.id === session?.providerId);

      if (!session || !providerForSession) {
          logger.error("Cannot process turn: Session or provider not found.");
          return;
      }
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsResponding(true);
      setThinkingText(null);
      accumulatedThinkingText.current = null;
      streamBuffer.current = '';
      inThinkBlockRef.current = false;

      const project = config.projects?.find(p => p.id === session.projectId);
      const tools: Tool[] = [];

      if (isElectron) {
          // Always add the code interpreter tool in the desktop app
          tools.push({
              type: 'function',
              function: {
                  name: 'executePython',
                  description: 'Executes a Python code snippet and returns its standard output and standard error. This is the primary way to run code.',
                  parameters: {
                      type: 'object',
                      properties: {
                          code: {
                              type: 'string',
                              description: 'The Python code to execute.'
                          }
                      },
                      required: ['code']
                  }
              }
          });
      }
      
      if (project && isElectron && session.agentToolsEnabled) {
          tools.push(
            { type: 'function', function: { name: 'listFiles', description: 'Recursively lists all files and directories within the project, returning an array of relative paths.', parameters: { type: 'object', properties: {} } } },
            { type: 'function', function: { name: 'readFile', description: "Reads a file's content.", parameters: { type: 'object', properties: { path: { type: 'string', description: 'The relative path to the file from the project root.' } }, required: ['path'] } } },
            { type: 'function', function: { name: 'writeFile', description: "Writes content to a file, overwriting it if it exists or creating it if it doesn't.", parameters: { type: 'object', properties: { path: { type: 'string', description: 'The relative path to the file from the project root.' }, content: { type: 'string', description: 'The new file content.' } }, required: ['path', 'content'] } } },
            { type: 'function', function: { name: 'runTerminalCommand', description: "Executes a shell command in the project's root directory.", parameters: { type: 'object', properties: { command: { type: 'string', description: 'The command to execute.' } }, required: ['command'] } } },
          );
      }

      let accumulatedContent = '';
      let accumulatedToolCalls: ToolCall[] = [];

      await streamChatCompletion(
          providerForSession, config.apiKeys, session.modelId, messages, tools.length > 0 ? tools : undefined, controller.signal,
          (chunk) => { // onChunk
              if (chunk.type === 'content') {
                  accumulatedContent += chunk.text;
                  appendToLastMessage(sessionId, chunk.text);
              } else if (chunk.type === 'tool_calls') {
                  accumulatedToolCalls.push(...chunk.tool_calls);
              }
          },
          (err) => { // onError
             const errorMsg: StandardChatMessage = { role: 'assistant', content: `Sorry, an error occurred: ${err.message}` };
             updateSessionMessages(sessionId, [...messages, errorMsg]);
             setIsResponding(false);
          },
          (metadata) => { // onDone
              const finalMessages = [...session.messages.slice(0, -1)]; // Remove placeholder
              let lastMsg: ChatMessage;

              if (accumulatedToolCalls.length > 0) {
                  lastMsg = {
                      role: 'assistant',
                      content: accumulatedContent || null,
                      tool_calls: accumulatedToolCalls,
                      metadata,
                  };
                  setPendingToolCalls(accumulatedToolCalls); // Trigger approval modal
              } else {
                  lastMsg = {
                      role: 'assistant',
                      content: accumulatedContent,
                      metadata,
                  };
                   setIsResponding(false);
              }

              updateSessionMessages(sessionId, [...messages, lastMsg]);
          },
          session.generationConfig
      );

  }, [config, appendToLastMessage, updateSessionMessages, isElectron]);


  const handleToolApproval = async (approvedCalls: ToolCall[]) => {
      if (!activeSessionId || !config) return;
      
      const currentSession = config.sessions?.find(s => s.id === activeSessionId);
      if (!currentSession) return;

      setPendingToolCalls(null);
      setIsResponding(true);

      const project = config.projects?.find(p => p.id === currentSession.projectId) || null;
      
      const lastMessageBeforeApproval = currentSession.messages[currentSession.messages.length - 1] as AssistantToolCallMessage;
      // FIX: Safely extract string content from the last message, which might have complex content type.
      // Since we know this is a tool call message, its content is `string | null`.
      const assistantContent = lastMessageBeforeApproval.content;

      const toolResults: ToolResponseMessage[] = [];

      // Update the UI immediately to show tools are running and approved/denied
      const updatedToolCallMsg: AssistantToolCallMessage = {
          role: 'assistant',
          content: assistantContent,
          tool_calls: approvedCalls,
      };
      updateSessionMessages(activeSessionId, [...currentSession.messages.slice(0, -1), updatedToolCallMsg]);
      
      let allResults = [];
      for (const call of approvedCalls) {
          let result: any;
          if (call.approved) {
              result = await executeToolCall(call, project);
          } else {
              result = "Tool execution was denied by the user.";
          }
          allResults.push({ ...call, result });
          
          toolResults.push({
              role: 'tool',
              tool_call_id: call.id,
              name: call.function.name,
              content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          });

          // Update UI with result as it comes
          const finalToolCallMsg: AssistantToolCallMessage = {
              role: 'assistant',
              content: assistantContent,
              tool_calls: allResults,
          };
          updateSessionMessages(activeSessionId, [...currentSession.messages.slice(0, -1), finalToolCallMsg]);
      }
      
      const newMessages = [...currentSession.messages.slice(0, -1), { ...updatedToolCallMsg, tool_calls: allResults }, ...toolResults];
      await processConversationTurn(activeSessionId, newMessages);
  };
  

  const handleSendMessage = useCallback(async (content: string | ChatMessageContentPart[], options?: { useRAG: boolean }) => {
    if (!config || !config.activeSessionId) return;
    
    const sessionId = config.activeSessionId;
    const session = config.sessions?.find(s => s.id === sessionId);
    if (!session) return;

    const isFirstUserMessage = session.messages.filter(m => m.role === 'user').length === 0;

    const userMessage: StandardChatMessage = { role: 'user', content };
    const assistantPlaceholder: StandardChatMessage = { role: 'assistant', content: '' };
    const messagesWithUser = [...session.messages, userMessage];
    updateSessionMessages(sessionId, [...messagesWithUser, assistantPlaceholder]);
    
    await processConversationTurn(sessionId, messagesWithUser);

    if (isFirstUserMessage) {
        setConfig(currentConfig => {
            if (!currentConfig) return null;
            const finalSession = currentConfig.sessions?.find(s => s.id === sessionId);
            if (finalSession) generateSessionName(finalSession);
            return currentConfig;
        });
    }

  }, [config, generateSessionName, updateSessionMessages, processConversationTurn]);

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

  const handleRunCodeSnippet = async (language: string, code: string) => {
    if (!isElectron) {
        if (language === 'python') {
            logger.info('Running Python code snippet in browser using Pyodide.');
            setRunOutput({ title: `Running Python (Pyodide)...`, stdout: 'Initializing WASM environment...', stderr: '' });
            const { result, error } = await runPythonCode(code);
            setRunOutput({ title: 'Python (Pyodide) Output', stdout: result, stderr: error || '' });
        } else {
            alert('Running code snippets in the browser is only supported for Python.');
        }
        return;
    }

    logger.info(`Running ${language} code snippet natively.`);
    setRunOutput({ title: `Running ${language}...`, stdout: 'Executing...', stderr: '' });
    let result: { stdout: string; stderr: string };
    try {
        if (language === 'python') {
            result = await window.electronAPI!.runPython(code);
        } else if (language === 'javascript') {
            result = await window.electronAPI!.runNodejs(code);
        } else if (language === 'html') {
            result = await window.electronAPI!.runHtml(code);
        } else {
            throw new Error(`Running snippets for language "${language}" is not supported.`);
        }
        setRunOutput({ title: `Output for ${language} snippet`, ...result });
    } catch (e) {
        const msg = `Failed to run snippet: ${e instanceof Error ? e.message : String(e)}`;
        logger.error(msg);
        setRunOutput({ title: `Error running ${language} snippet`, stdout: '', stderr: msg });
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
            return <InfoView theme={config.theme || 'dark'} onOpenAbout={() => setIsAboutModalOpen(true)} />;
        case 'projects':
            return <ProjectsView 
                config={config}
                onConfigChange={handleConfigChange}
                isElectron={isElectron}
                onInjectContentForChat={handleInjectContentForChat}
                onRunProject={handleRunProject}
                onNewChatWithProject={handleNewChatWithProject}
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
                 const providerForSession = providers.find(p => p.id === activeSession.providerId) || null;
                 return (
                    <ChatView
                        key={activeSession.id}
                        session={activeSession}
                        provider={providerForSession}
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
                        models={models}
                        onSelectModel={handleSelectModel}
                        predefinedPrompts={config.predefinedPrompts || []}
                        systemPrompts={config.systemPrompts || []}
                        onSetSessionSystemPrompt={handleSetSessionSystemPrompt}
                        onSetSessionGenerationConfig={handleSetSessionGenerationConfig}
                        onSetSessionAgentToolsEnabled={handleSetSessionAgentToolsEnabled}
                        onRunCodeSnippet={handleRunCodeSnippet}
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

  const activeProjectName = activeSession?.projectId
      ? config?.projects?.find(p => p.id === activeSession.projectId)?.name || null
      : null;

  return (
    <IconProvider iconSet={config?.themeOverrides?.iconSet || 'default'}>
      <TooltipProvider>
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
          <AboutModal 
            isOpen={isAboutModalOpen} 
            onClose={() => setIsAboutModalOpen(false)} 
            version={appVersion} 
          />
          {runOutput && <RunOutputModal runOutput={runOutput} onClose={() => setRunOutput(null)} />}
          {pendingToolCalls && (
              <ToolCallApprovalModal
                toolCalls={pendingToolCalls}
                onFinalize={handleToolApproval}
                onClose={() => setPendingToolCalls(null)}
              />
          )}
          <header className="flex items-center justify-between p-[var(--space-2)] border-b border-[--border-primary] bg-[--bg-primary] sticky top-0 z-10 flex-shrink-0">
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
                  version={appVersion}
              />
          )}
        </div>
      </TooltipProvider>
    </IconProvider>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
);

export default App;

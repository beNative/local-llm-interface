import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Config, Model, ChatMessage, Theme, CodeProject, ChatSession, ChatMessageContentPart, PredefinedPrompt, ChatMessageMetadata, SystemPrompt, FileSystemEntry, SystemStats, GenerationConfig, LLMProviderConfig, Tool, ToolCall, AssistantToolCallMessage, ToolResponseMessage, StandardChatMessage, ChatMessageContentPartText, ShortcutActionId, ShortcutSettings } from './types';
import { APP_NAME, DEFAULT_PROVIDERS, DEFAULT_SYSTEM_PROMPT, SESSION_NAME_PROMPT } from './constants';
import { fetchModels, streamChatCompletion, LLMServiceError, generateTextCompletion, StreamChunk } from './services/llmService';
import { logger } from './services/logger';
import SettingsPanel, { type SettingsSection } from './components/SettingsPanel';
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
import ModalContainer from './components/Modal';
import StatusBar from './components/StatusBar';
import Icon from './components/Icon';
import { IconProvider } from './components/IconProvider';
import { TooltipProvider } from './components/TooltipProvider';
import ToolCallApprovalModal from './components/ToolCallApprovalModal';
import { runPythonCode } from './services/pyodideService';
import { ToastProvider, ToastContainer } from './components/ToastProvider';
import { useToast } from './hooks/useToast';
import TitleBar from './components/TitleBar';
import { useTooltipTrigger } from './hooks/useTooltipTrigger';
import { allowsTypingContext, ensureShortcutSettings, eventToShortcut, getDefaultShortcutSettings, getEffectiveShortcut, getGlobalShortcutRegistrations, SHORTCUT_DEFINITION_MAP, SHORTCUT_DEFINITIONS } from './shortcuts';
import { useInstrumentation } from './hooks/useInstrumentation';
import { useAutomationRegistration } from './hooks/useAutomationRegistration';
import type { AutomationTarget } from './services/instrumentation/types';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const SIDEBAR_KEYBOARD_STEP = 16;
const SIDEBAR_KEYBOARD_LARGE_STEP = 48;

const clampSidebarWidth = (value: number) =>
    Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  view: View;
  title: string;
}> = ({ active, onClick, children, ariaLabel, view, title }) => {
    const accentVar = `var(--accent-${view})`;
    const tooltipProps = useTooltipTrigger(title);
    const nodeRef = useRef<HTMLButtonElement | null>(null);
    const [automationTarget, setAutomationTarget] = useState<AutomationTarget | null>(null);

    const setButtonRef = useCallback(
        (node: HTMLButtonElement | null) => {
            nodeRef.current = node;
            if (!node) {
                setAutomationTarget(null);
                return;
            }

            setAutomationTarget({
                id: `nav-${view}`,
                description: `Navigation button for ${view} view`,
                element: node,
                metadata: { view, active },
                actions: {
                    click: ({ element }) => (element ?? node)?.click(),
                    focus: ({ element }) => (element ?? node)?.focus(),
                    isActive: () => active,
                },
            });
        },
        [view, active],
    );

    useEffect(() => {
        if (!nodeRef.current) {
            return;
        }
        setAutomationTarget({
            id: `nav-${view}`,
            description: `Navigation button for ${view} view`,
            element: nodeRef.current,
            metadata: { view, active },
            actions: {
                click: ({ element }) => (element ?? nodeRef.current)?.click(),
                focus: ({ element }) => (element ?? nodeRef.current)?.focus(),
                isActive: () => active,
            },
        });
    }, [view, active]);

    useAutomationRegistration(automationTarget);
    return (
        <button
            ref={setButtonRef}
            onClick={onClick}
            aria-label={ariaLabel}
            {...tooltipProps}
            data-automation-id={`nav-${view}`}
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
    return (
        <ModalContainer
            onClose={onClose}
            title={runOutput.title}
            titleId="run-output-modal-title"
            descriptionId="run-output-modal-content"
            size="lg"
            bodyClassName="font-mono text-xs space-y-[var(--space-4)]"
            footer={
                <button
                    onClick={onClose}
                    className="px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-[--border-radius] hover:bg-[--bg-hover] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--border-focus]"
                >
                    Close
                </button>
            }
        >
            {runOutput.stdout && (
                <section className="space-y-[var(--space-2)] font-sans text-[length:var(--font-size-sm)]">
                    <h3 className="text-[--text-muted] font-semibold uppercase">Output (stdout)</h3>
                    <pre className="whitespace-pre-wrap rounded-[--border-radius] bg-[--bg-tertiary] p-[var(--space-3)] font-mono text-[--text-secondary]">
                        {runOutput.stdout}
                    </pre>
                </section>
            )}
            {runOutput.stderr && (
                <section className="space-y-[var(--space-2)] font-sans text-[length:var(--font-size-sm)]">
                    <h3 className="font-semibold uppercase text-red-500">Error (stderr)</h3>
                    <pre className="whitespace-pre-wrap rounded-[--border-radius] bg-red-900/20 p-[var(--space-3)] font-mono text-red-500">
                        {runOutput.stderr}
                    </pre>
                </section>
            )}
            {!runOutput.stdout && !runOutput.stderr && (
                <p className="font-sans text-[--text-muted]">The script produced no output.</p>
            )}
        </ModalContainer>
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
  const [isElectron, setIsElectron] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState('');
  const [runOutput, setRunOutput] = useState<{ title: string; stdout: string; stderr: string; } | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [paletteAnchorRect, setPaletteAnchorRect] = useState<DOMRect | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[] | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [targetSettingsSection, setTargetSettingsSection] = useState<SettingsSection | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(205); // 20% reduction from the previous 256px default
  const chatInputFocusHandlerRef = useRef<(() => void) | null>(null);

  const toggleLogsTooltip = useTooltipTrigger('Toggle the application logs panel for debugging');
  const isResizingRef = useRef(false);
  const { addToast } = useToast();
  const [isMaximized, setIsMaximized] = useState(false);
  const instrumentationApi = useInstrumentation();
  const { log: instrumentationLog, performance: performanceMonitor, hooks: hookRegistry } = instrumentationApi;
  const instrumentationStateRef = useRef({
    view: 'chat' as View,
    isLogPanelVisible: false,
    isCommandPaletteOpen: false,
    isResponding: false,
    activeSessionId: undefined as string | undefined,
    modelsLoaded: 0,
  });
  const lastLoadedModelsSignatureRef = useRef<string | null>(null);
  const lastPersistedConfigSignatureRef = useRef<string | null>(null);
  const persistConfigTimeoutRef = useRef<number | null>(null);
  const pendingConfigRef = useRef<Config | null>(null);
  const pendingConfigSignatureRef = useRef<string | null>(null);


  // Derived state from config
  const sessions = config?.sessions || [];
  const activeSessionId = config?.activeSessionId;
  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const providers = config?.providers || [];
  const selectedProviderId = config?.selectedProviderId;
  const activeProvider = providers.find(p => p.id === selectedProviderId) || null;
  const shortcutSettings = useMemo<ShortcutSettings>(() => ensureShortcutSettings(config?.shortcuts), [config?.shortcuts]);
  const appShortcutMap = useMemo(() => {
    const map = new Map<string, ShortcutActionId>();
    SHORTCUT_DEFINITIONS.forEach(def => {
      const key = getEffectiveShortcut(shortcutSettings, def.id, 'app');
      if (key) {
        map.set(key, def.id);
      }
    });
    return map;
  }, [shortcutSettings]);
  const globalRegistrations = useMemo(() => getGlobalShortcutRegistrations(shortcutSettings), [shortcutSettings]);
  const globalRegistrationSignatureRef = useRef('');

  useEffect(() => {
    instrumentationStateRef.current = {
      view,
      isLogPanelVisible,
      isCommandPaletteOpen,
      isResponding,
      activeSessionId,
      modelsLoaded: models.length,
    };
  }, [view, isLogPanelVisible, isCommandPaletteOpen, isResponding, activeSessionId, models.length]);

  useEffect(() => {
    instrumentationLog('info', 'Primary view changed', { view });
  }, [view, instrumentationLog]);

  useEffect(() => {
    if (!hookRegistry) {
      return;
    }

    const viewHookId = hookRegistry.register<{ view: View }, View>({
      id: 'app:set-view',
      description: 'Switches the primary application view.',
      handler: ({ args }) => {
        const targetView = args?.view;
        if (!['chat', 'projects', 'api', 'settings', 'info'].includes(targetView)) {
          throw new Error(`Invalid view requested: ${String(targetView)}`);
        }
        setView(targetView as View);
        return targetView as View;
      },
    });

    const snapshotHookId = hookRegistry.register<void, typeof instrumentationStateRef.current>({
      id: 'app:get-state',
      description: 'Returns a snapshot of the primary UI state for diagnostics.',
      handler: () => instrumentationStateRef.current,
    });

    const toggleLogsHookId = hookRegistry.register({
      id: 'app:toggle-logs',
      description: 'Toggles the log panel visibility.',
      handler: () => {
        setIsLogPanelVisible(prev => !prev);
      },
    });

    return () => {
      hookRegistry.unregister(viewHookId);
      hookRegistry.unregister(snapshotHookId);
      hookRegistry.unregister(toggleLogsHookId);
    };
  }, [hookRegistry]);

  const registerChatInputFocusHandler = useCallback((handler: (() => void) | null) => {
    chatInputFocusHandlerRef.current = handler;
  }, []);

  const openSettings = useCallback((section?: SettingsSection | null) => {
    setTargetSettingsSection(section ?? null);
    setView('settings');
  }, []);

  const handleThemeToggle = useCallback(() => {
    setConfig(currentConfig => {
      if (!currentConfig) return null;
      const newTheme = currentConfig.theme === 'light' ? 'dark' : 'light';
      logger.info(`Theme toggled to ${newTheme}.`);
      return { ...currentConfig, theme: newTheme };
    });
  }, []);

  const handleNewChat = useCallback(() => {
    instrumentationLog('debug', 'Starting new chat session');
    setConfig(c => (c ? { ...c, activeSessionId: undefined } : null));
    setView('chat');
  }, [instrumentationLog]);

  const performShortcutAction = useCallback((actionId: ShortcutActionId) => {
    switch (actionId) {
      case 'toggleCommandPalette':
        setPaletteAnchorRect(null);
        setIsCommandPaletteOpen(prev => !prev);
        break;
      case 'openSettings':
        openSettings();
        break;
      case 'startNewChat':
        handleNewChat();
        setTimeout(() => chatInputFocusHandlerRef.current?.(), 150);
        break;
      case 'focusChatInput':
        setView('chat');
        setTimeout(() => chatInputFocusHandlerRef.current?.(), 50);
        break;
      case 'toggleLogsPanel':
        setIsLogPanelVisible(prev => !prev);
        break;
      case 'toggleTheme':
        handleThemeToggle();
        break;
      case 'showChatView':
        setView('chat');
        break;
      case 'showProjectsView':
        setView('projects');
        break;
      case 'showApiView':
        setView('api');
        break;
      case 'showInfoView':
        setView('info');
        break;
      default:
        break;
    }
  }, [handleThemeToggle, handleNewChat, openSettings]);

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
        autoCheckForUpdates: true,
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
        shortcuts: getDefaultShortcutSettings(),
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

      loadedConfig.shortcuts = ensureShortcutSettings(loadedConfig.shortcuts);

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
    (document.documentElement.style as any).zoom = `${scale / 100}`;
    logger.debug(`Application scale set to: ${scale}%`);
  }, [config?.themeOverrides?.scale]);

  // Effect to apply control density.
  useEffect(() => {
      const density = config?.themeOverrides?.density || 'normal';
      document.documentElement.setAttribute('data-density', density);
      logger.debug(`Application density set to: ${density}`);
  }, [config?.themeOverrides?.density]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = eventToShortcut(event);
      if (!shortcut) return;
      const actionId = appShortcutMap.get(shortcut);
      if (!actionId) return;
      const target = event.target as HTMLElement;
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable && !allowsTypingContext(actionId)) {
        return;
      }
      event.preventDefault();
      performShortcutAction(actionId);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [appShortcutMap, performShortcutAction]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    const handler = (actionId: ShortcutActionId) => {
      performShortcutAction(actionId);
    };
    window.electronAPI.onShortcutTriggered(handler);
    return () => {
      window.electronAPI?.removeShortcutTriggeredListener();
    };
  }, [isElectron, performShortcutAction]);

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    const signature = JSON.stringify(globalRegistrations);
    if (signature === globalRegistrationSignatureRef.current) {
      return;
    }
    globalRegistrationSignatureRef.current = signature;
    let cancelled = false;
    window.electronAPI
      .registerGlobalShortcuts(globalRegistrations)
      .then(results => {
        if (cancelled || !results) return;
        results.forEach(result => {
          if (!result.success) {
            const label = SHORTCUT_DEFINITION_MAP[result.actionId]?.label || result.actionId;
            const accelerator = result.accelerator || 'shortcut';
            const errorDetail = result.error ? ` ${result.error}` : '';
            addToast({
              type: 'error',
              message: `Failed to register ${accelerator} for ${label}.${errorDetail}`,
              duration: 5000,
            });
          }
        });
      })
      .catch(error => {
        if (!cancelled) {
          addToast({ type: 'error', message: `Global shortcut registration failed: ${error instanceof Error ? error.message : String(error)}` });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isElectron, globalRegistrations, addToast]);

  // Effect to persist config changes.
  useEffect(() => {
    if (!config) {
      if (persistConfigTimeoutRef.current !== null) {
        window.clearTimeout(persistConfigTimeoutRef.current);
        persistConfigTimeoutRef.current = null;
      }
      pendingConfigRef.current = null;
      pendingConfigSignatureRef.current = null;
      return;
    }

    const signature = JSON.stringify(config);
    if (signature === lastPersistedConfigSignatureRef.current) {
      return;
    }

    pendingConfigRef.current = config;
    pendingConfigSignatureRef.current = signature;

    if (persistConfigTimeoutRef.current !== null) {
      window.clearTimeout(persistConfigTimeoutRef.current);
    }

    persistConfigTimeoutRef.current = window.setTimeout(() => {
      if (!pendingConfigRef.current || !pendingConfigSignatureRef.current) {
        return;
      }

      if (window.electronAPI) {
        window.electronAPI.saveSettings(pendingConfigRef.current);
      } else {
        localStorage.setItem('llm_config', pendingConfigSignatureRef.current);
      }

      lastPersistedConfigSignatureRef.current = pendingConfigSignatureRef.current;

      persistConfigTimeoutRef.current = null;
    }, 400);

    return () => {
      if (persistConfigTimeoutRef.current !== null) {
        window.clearTimeout(persistConfigTimeoutRef.current);
        persistConfigTimeoutRef.current = null;
      }
    };
  }, [config]);

  useEffect(() => {
    return () => {
      if (persistConfigTimeoutRef.current !== null) {
        window.clearTimeout(persistConfigTimeoutRef.current);
        persistConfigTimeoutRef.current = null;
      }

      if (
        pendingConfigRef.current &&
        pendingConfigSignatureRef.current &&
        pendingConfigSignatureRef.current !== lastPersistedConfigSignatureRef.current
      ) {
        if (window.electronAPI) {
          window.electronAPI.saveSettings(pendingConfigRef.current);
        } else {
          localStorage.setItem('llm_config', pendingConfigSignatureRef.current);
        }

        lastPersistedConfigSignatureRef.current = pendingConfigSignatureRef.current;
      }
    };
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
                addToast({ type: 'info', message: `New version ${info.version} found.` });
            };
            const handleUpdateDownloading = () => {
                addToast({ type: 'info', message: `Downloading update...`, duration: 10000 });
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
            const handleUpdateNotAvailable = () => {
                 addToast({ type: 'success', message: 'You are on the latest version.', duration: 3000 });
            };

            window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
            window.electronAPI.onUpdateDownloading(handleUpdateDownloading);
            window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
            window.electronAPI.onUpdateError(handleUpdateError);
            window.electronAPI.onUpdateNotAvailable(handleUpdateNotAvailable);

            return () => {
                window.electronAPI!.removeUpdateAvailableListener();
                window.electronAPI!.removeUpdateDownloadingListener();
                window.electronAPI!.removeUpdateDownloadedListener();
                window.electronAPI!.removeUpdateErrorListener();
                window.electronAPI!.removeUpdateNotAvailableListener();
            }
        }
    }, [isElectron, addToast]);
    
    // Effect for window state changes (maximize/unmaximize)
    useEffect(() => {
        if (isElectron && window.electronAPI) {
            const handler = (maximized: boolean) => setIsMaximized(maximized);
            window.electronAPI.onWindowStateChange(handler);
            return () => {
                window.electronAPI?.removeWindowStateChangeListener();
            };
        }
    }, [isElectron]);


  const handleConfigChange = useCallback((incomingConfig: Config) => {
    logger.info('Configuration change requested.');

    const normalizedConfig: Config = {
      ...incomingConfig,
      shortcuts: ensureShortcutSettings(incomingConfig.shortcuts),
    };

    setConfig(currentConfig => {
      if (!currentConfig) return normalizedConfig;

      const oldProvider = currentConfig.providers?.find(p => p.id === currentConfig.selectedProviderId);
      const newProvider = normalizedConfig.providers?.find(p => p.id === normalizedConfig.selectedProviderId);

      const needsModelReload = !oldProvider || !newProvider ||
        newProvider.id !== oldProvider.id ||
        newProvider.baseUrl !== oldProvider.baseUrl ||
        (newProvider.apiKeyName && normalizedConfig.apiKeys?.[newProvider.apiKeyName] !== currentConfig.apiKeys?.[newProvider.apiKeyName]);

      if (needsModelReload) {
        logger.info('Provider, Base URL, or API Key changed. Reloading models.');
        setView('chat');
        return { ...normalizedConfig, activeSessionId: undefined };
      }

      return { ...currentConfig, ...normalizedConfig };
    });

    logger.setConfig({ logToFile: normalizedConfig.logToFile });
  }, []);
  
  const handleProviderChange = useCallback((providerId: string) => {
    instrumentationLog('info', 'Provider change requested', { providerId });
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
  }, [instrumentationLog]);

  const loadModels = useCallback(async (provider: LLMProviderConfig, apiKeys: Config['apiKeys']): Promise<boolean> => {
    setIsLoadingModels(true);
    setError(null);
    const sampleId = performanceMonitor?.startSample('load-models') ?? null;
    const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let success = false;
    instrumentationLog('info', 'Loading models', { providerId: provider.id });
    try {
      const fetchedModels = await fetchModels(provider, apiKeys);
      setModels(fetchedModels);
      success = true;
    } catch (err) {
      const errorMessage = err instanceof LLMServiceError ? err.message : 'An unexpected error occurred.';
      instrumentationLog('error', 'Failed to load models', {
        providerId: provider.id,
        error: errorMessage,
      });
      setError(errorMessage);
      setModels([]);
    } finally {
      const finishedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const duration = finishedAt - startedAt;
      if (performanceMonitor && sampleId) {
        performanceMonitor.recordMetric(sampleId, {
          name: 'loadModels',
          duration,
          entryType: 'custom',
          timestamp: Date.now(),
          detail: { providerId: provider.id, success },
        });
        performanceMonitor.finishSample(sampleId, {
          providerId: provider.id,
          success,
        });
      }
      setIsLoadingModels(false);
    }
    return success;
  }, [performanceMonitor, instrumentationLog]);

  const hasConfig = config !== null;
  const apiKeys = config?.apiKeys;
  const activeProviderApiKey = activeProvider?.apiKeyName ? apiKeys?.[activeProvider.apiKeyName] ?? '' : '';
  const activeProviderSignature = useMemo(() => {
    if (!activeProvider) return 'none';
    return [
      activeProvider.id,
      activeProvider.baseUrl,
      activeProvider.type,
      activeProvider.apiKeyName || '',
      activeProviderApiKey,
    ].join('|');
  }, [
    activeProvider?.id,
    activeProvider?.baseUrl,
    activeProvider?.type,
    activeProvider?.apiKeyName,
    activeProviderApiKey,
  ]);

  useEffect(() => {
    const viewRequiresModels = view === 'chat' || view === 'api';

    if (!hasConfig) {
      lastLoadedModelsSignatureRef.current = null;
      return;
    }

    if (!viewRequiresModels) {
      return;
    }

    if (!activeProvider) {
      setError("Provider configuration not loaded. Please select a provider in Settings.");
      setModels([]);
      lastLoadedModelsSignatureRef.current = null;
      return;
    }

    if (lastLoadedModelsSignatureRef.current === activeProviderSignature) {
      return;
    }

    const run = async () => {
      const wasSuccessful = await loadModels(activeProvider, apiKeys);
      lastLoadedModelsSignatureRef.current = wasSuccessful ? activeProviderSignature : null;
    };

    void run();
  }, [
    view,
    hasConfig,
    activeProvider,
    activeProviderSignature,
    loadModels,
    apiKeys,
  ]);
  
  const handleSelectSession = (sessionId: string) => {
    setConfig(c => c ? ({ ...c, activeSessionId: sessionId }) : null);
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

  const [streamingDrafts, setStreamingDrafts] = useState<Record<string, string>>({});

  const streamingDraftBufferRef = useRef<Record<string, { pending: string; timeoutId: ReturnType<typeof setTimeout> | null }>>({});

  const commitStreamingDraft = useCallback((sessionId: string, chunk: string) => {
      if (!chunk) {
          return;
      }
      setStreamingDrafts(prev => {
          const existing = prev[sessionId] || '';
          const combined = existing + chunk;
          if (combined === existing) {
              return prev;
          }
          return { ...prev, [sessionId]: combined };
      });
  }, []);

  const flushStreamingDraftBuffer = useCallback((sessionId: string) => {
      const buffer = streamingDraftBufferRef.current[sessionId];
      if (!buffer) return;

      if (buffer.timeoutId !== null) {
          clearTimeout(buffer.timeoutId);
          buffer.timeoutId = null;
      }

      if (buffer.pending) {
          const pending = buffer.pending;
          buffer.pending = '';
          commitStreamingDraft(sessionId, pending);
      }

      delete streamingDraftBufferRef.current[sessionId];
  }, [commitStreamingDraft]);

  const appendStreamingDraft = useCallback((sessionId: string, contentChunk: string) => {
      if (!contentChunk) return;

      let buffer = streamingDraftBufferRef.current[sessionId];
      if (!buffer) {
          buffer = { pending: '', timeoutId: null };
          streamingDraftBufferRef.current[sessionId] = buffer;
      }

      buffer.pending += contentChunk;

      if (buffer.timeoutId === null) {
          buffer.timeoutId = setTimeout(() => {
              buffer.timeoutId = null;
              const pending = buffer.pending;
              buffer.pending = '';
              if (pending) {
                  commitStreamingDraft(sessionId, pending);
              }

              if (!streamingDraftBufferRef.current[sessionId]?.pending) {
                  delete streamingDraftBufferRef.current[sessionId];
              }
          }, 24);
      }
  }, [commitStreamingDraft]);

  const clearStreamingDraft = useCallback((sessionId: string) => {
      const buffer = streamingDraftBufferRef.current[sessionId];
      if (buffer) {
          if (buffer.timeoutId !== null) {
              clearTimeout(buffer.timeoutId);
          }
          delete streamingDraftBufferRef.current[sessionId];
      }

      setStreamingDrafts(prev => {
          if (!(sessionId in prev)) {
              return prev;
          }
          const next = { ...prev };
          delete next[sessionId];
          return next;
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
      setPendingToolCalls(null);
      if (config?.activeSessionId) {
          clearStreamingDraft(config.activeSessionId);
      }
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

      clearStreamingDraft(sessionId);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsResponding(true);

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
                  appendStreamingDraft(sessionId, chunk.text);
              } else if (chunk.type === 'tool_calls') {
                  accumulatedToolCalls.push(...chunk.tool_calls);
              }
          },
          (err) => { // onError
             clearStreamingDraft(sessionId);
             const errorMsg: StandardChatMessage = { role: 'assistant', content: `Sorry, an error occurred: ${err.message}` };
             updateSessionMessages(sessionId, [...messages, errorMsg]);
             setIsResponding(false);
          },
          (metadata) => { // onDone
              flushStreamingDraftBuffer(sessionId);
              clearStreamingDraft(sessionId);
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

  }, [config, updateSessionMessages, isElectron, appendStreamingDraft, clearStreamingDraft, flushStreamingDraftBuffer]);


  const handleToolApproval = async (approvedCalls: ToolCall[]) => {
      if (!activeSessionId || !config) return;
      
      const currentSession = config.sessions?.find(s => s.id === activeSessionId);
      if (!currentSession) return;

      setPendingToolCalls(null);
      setIsResponding(true);

      const project = config.projects?.find(p => p.id === currentSession.projectId) || null;
      
      const lastMessageBeforeApproval = currentSession.messages[currentSession.messages.length - 1] as AssistantToolCallMessage;
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
    openSettings();
  };

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const nextWidth = clampSidebarWidth(e.clientX);
    setSidebarWidth(prev => (prev === nextWidth ? prev : nextWidth));
  }, []);

  const adjustSidebarWidth = useCallback((delta: number) => {
    if (delta === 0) {
      return;
    }
    setSidebarWidth(prev => {
      const next = clampSidebarWidth(prev + delta);
      return next === prev ? prev : next;
    });
  }, []);

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? SIDEBAR_KEYBOARD_LARGE_STEP : SIDEBAR_KEYBOARD_STEP;

      switch (event.key) {
        case 'ArrowLeft':
        case 'PageDown':
          event.preventDefault();
          adjustSidebarWidth(-step);
          break;
        case 'ArrowRight':
        case 'PageUp':
          event.preventDefault();
          adjustSidebarWidth(step);
          break;
        case 'Home':
          event.preventDefault();
          setSidebarWidth(prev => (prev === SIDEBAR_MIN_WIDTH ? prev : SIDEBAR_MIN_WIDTH));
          break;
        case 'End':
          event.preventDefault();
          setSidebarWidth(prev => (prev === SIDEBAR_MAX_WIDTH ? prev : SIDEBAR_MAX_WIDTH));
          break;
        default:
          break;
      }
    },
    [adjustSidebarWidth],
  );

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

  useEffect(() => {
    if (view !== 'settings' && targetSettingsSection !== null) {
      setTargetSettingsSection(null);
    }
  }, [view, targetSettingsSection]);

  const handleOpenFileFromPalette = (file: { path: string; name: string }) => {
    setView('projects');
    setEditingFile(file);
    // Note: This won't auto-expand the project tree, but it opens the file, which is the main goal.
  };

  const handleOpenKeyboardShortcuts = useCallback(() => {
    openSettings('shortcuts');
  }, [openSettings]);

  const openCommandPalette = (rect: DOMRect) => {
    setPaletteAnchorRect(rect);
    setIsCommandPaletteOpen(true);
  };

  const closeCommandPalette = () => {
    setIsCommandPaletteOpen(false);
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
                initialSection={targetSettingsSection}
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
                        session={activeSession}
                        provider={providerForSession}
                        onSendMessage={handleSendMessage}
                        isResponding={isResponding || retrievalStatus === 'retrieving'}
                        streamingDraft={streamingDrafts[activeSession.id] ?? null}
                        retrievalStatus={retrievalStatus}
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
                        onRegisterInputFocusHandler={registerChatInputFocusHandler}
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
      
  const scale = config?.themeOverrides?.scale || 100;
  const zoomFactor = scale > 0 ? scale / 100 : 1;
  
  const containerStyle: React.CSSProperties = {
    // When zoom is applied, vh units are scaled. To counteract this and ensure
    // the container always fills the viewport height, we calculate the inverse.
    // e.g., if zoom is 0.8 (80%), we set height to 125vh (100/0.8).
    // The final rendered height becomes 125vh * 0.8 = 100vh.
    height: `calc(100vh / ${zoomFactor})`,
  };

  return (
    <IconProvider iconSet={config?.themeOverrides?.iconSet || 'default'}>
        <div style={containerStyle} className="flex flex-col font-sans bg-[--bg-primary] h-screen overflow-hidden text-[--text-primary]">
          {config && <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={closeCommandPalette}
            sessions={config.sessions || []}
            projects={config.projects || []}
            onNavigate={setView}
            onSelectSession={handleSelectSession}
            onOpenFile={handleOpenFileFromPalette}
            anchorRect={paletteAnchorRect}
            onShowKeyboardShortcuts={handleOpenKeyboardShortcuts}
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
          
          {isElectron && config ? (
            <TitleBar
                activeView={view}
                onNavigate={setView}
                onToggleLogs={() => setIsLogPanelVisible(!isLogPanelVisible)}
                onToggleTheme={handleThemeToggle}
                theme={config.theme || 'dark'}
                onOpenCommandPalette={openCommandPalette}
                isMaximized={isMaximized}
            />
          ) : (
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
                <NavButton active={view === 'settings'} onClick={() => openSettings()} title="Configure application settings" ariaLabel="Settings View" view="settings">
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
                  {...toggleLogsTooltip}
                  >
                  <Icon name="fileText" className="w-5 h-5" />
                  </button>
                <ThemeSwitcher theme={config?.theme || 'dark'} onToggle={handleThemeToggle} />
              </div>
            </header>
          )}

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
                  onKeyDown={handleResizeKeyDown}
                  className="w-1.5 flex-shrink-0 cursor-col-resize bg-[--bg-tertiary] hover:bg-[--border-focus] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[--border-focus]"
                  aria-label="Resize sidebar"
                  aria-orientation="vertical"
                  aria-valuemin={SIDEBAR_MIN_WIDTH}
                  aria-valuemax={SIDEBAR_MAX_WIDTH}
                  aria-valuenow={sidebarWidth}
                  aria-valuetext={`${sidebarWidth} pixels`}
                  role="separator"
                  tabIndex={0}
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
    </IconProvider>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <TooltipProvider>
      <AppContent />
      <ToastContainer />
    </TooltipProvider>
  </ToastProvider>
);

export default App;
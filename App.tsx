import React, { useState, useEffect, useCallback } from 'react';
import type { Config, Model, ChatMessage, Theme, CodeProject } from './types';
import { APP_NAME, PROVIDER_CONFIGS, DEFAULT_SYSTEM_PROMPT } from './constants';
import { fetchModels, streamChatCompletion, LLMServiceError } from './services/llmService';
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

type View = 'chat' | 'settings' | 'info' | 'projects' | 'api';

const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}> = ({ active, onClick, children, ariaLabel }) => (
  <button 
    onClick={onClick} 
    aria-label={ariaLabel}
    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
    active 
      ? 'bg-black/10 dark:bg-white/10 text-[--text-primary]' 
      : 'text-[--text-muted] hover:bg-black/5 dark:hover:bg-white/5'
  }`}>
    {children}
  </button>
);

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
                        <pre className="whitespace-pre-wrap text-[--text-secondary] bg-[--bg-tertiary] p-3 rounded">{runOutput.stdout}</pre>
                    </div>
                )}
                {runOutput.stderr && (
                    <div className="mt-4">
                        <h3 className="text-red-500 font-sans font-semibold text-sm mb-1 uppercase">Error (stderr)</h3>
                        <pre className="whitespace-pre-wrap text-red-500 bg-red-900/20 p-3 rounded">{runOutput.stderr}</pre>
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
  const [currentChatModelId, setCurrentChatModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(false);
  const [prefilledInput, setPrefilledInput] = useState('');
  const [runOutput, setRunOutput] = useState<{ title: string; stdout: string; stderr: string; } | null>(null);


  // Effect for one-time app initialization and loading settings
  useEffect(() => {
    logger.info('App initializing...');
    const loadInitialConfig = async () => {
      logger.debug('Loading initial config.');
      const defaultConfig: Config = { 
        provider: 'Ollama', 
        baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
        theme: 'dark',
        logToFile: false,
        pythonProjectsPath: '',
        nodejsProjectsPath: '',
        webAppsPath: '',
        projects: [],
        pythonCommand: 'python',
        apiRecentPrompts: [],
      };
      
      let loadedConfig = defaultConfig;

      if (window.electronAPI) {
        setIsElectron(true);
        logger.info('Electron environment detected.');
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          logger.info('Loaded settings from file.');
          loadedConfig = { ...defaultConfig, ...savedSettings, projects: savedSettings.projects || [] };
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
            loadedConfig = { ...defaultConfig, ...savedSettings, projects: savedSettings.projects || [] };
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
    
    // Create a stable reference for comparison
    const previousConfig = { ...config };

    setConfig(currentConfig => {
      if (!currentConfig) return newConfig; // Should not happen if config is not null
      
      // When settings are saved from the panel, we want to retain the theme.
      // The theme is only changed by the theme toggler.
      return { ...newConfig, theme: currentConfig.theme, apiRecentPrompts: currentConfig.apiRecentPrompts };
    });
    
    logger.setConfig({ logToFile: newConfig.logToFile });
    
    const needsModelReload = newConfig.baseUrl !== previousConfig.baseUrl || newConfig.provider !== previousConfig.provider;
    
    if (needsModelReload) {
      logger.info('Provider or Base URL changed, resetting to model selection.');
      setCurrentChatModelId(null); 
      setMessages([]);
      // The view change is handled by the component calling onConfigChange
    }
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
    if (config?.baseUrl && (view === 'chat' || view === 'api') && !currentChatModelId) {
      loadModels();
    }
  }, [view, currentChatModelId, config?.baseUrl, loadModels]);

  const handleSelectModel = (modelId: string) => {
    logger.info(`Model selected: ${modelId}`);
    setCurrentChatModelId(modelId);
    setMessages([{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }]);
    setView('chat');
  };

  const handleBackToSelection = () => {
    logger.info('Returning to model selection screen.');
    setCurrentChatModelId(null);
    setMessages([]);
    setView('chat'); // Stays on chat view to trigger model load
  };

  const handleSendMessage = async (userInput: string) => {
    if (!currentChatModelId || !config) return;

    logger.info(`Sending message from user to model ${currentChatModelId}.`);
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    setIsResponding(true);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    await streamChatCompletion(
      config.baseUrl,
      currentChatModelId,
      newMessages,
      (chunk) => {
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
                const updatedMsg = { ...lastMsg, content: lastMsg.content + chunk };
                return [...prev.slice(0, -1), updatedMsg];
            }
            return prev;
        });
      },
      (err) => {
        const errorMsgContent = `Sorry, an error occurred: ${err.message}`;
        const errorMsg: ChatMessage = { role: 'assistant', content: errorMsgContent };
        setMessages(prev => [...prev.slice(0,-1), errorMsg]);
        setIsResponding(false);
      },
      () => {
        setIsResponding(false);
        logger.info('Message stream completed.');
      }
    );
  };

  const handleInjectContentForChat = (filename: string, content: string) => {
    const formattedContent = `Here is the content of \`${filename}\` for context:\n\n\`\`\`\n${content}\n\`\`\`\n\nI have a question about this file.`;
    setPrefilledInput(formattedContent);
    setView('chat');
    logger.info(`Injected content of ${filename} into chat input.`);
  };

  const onPrefillConsumed = () => {
    setPrefilledInput('');
  };
  
  const handleSaveApiPrompt = (prompt: string) => {
    setConfig(currentConfig => {
        if (!currentConfig) return null;
        const recent = currentConfig.apiRecentPrompts || [];
        const updatedRecent = [prompt, ...recent.filter(p => p !== prompt)].slice(0, 10); // Limit to 10
        return { ...currentConfig, apiRecentPrompts: updatedRecent };
    });
    logger.info(`Saved API prompt to history.`);
  };

  const handleClearApiPrompts = () => {
      setConfig(currentConfig => {
          if (!currentConfig) return null;
          return { ...currentConfig, apiRecentPrompts: [] };
      });
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

  const renderContent = () => {
    if (!config) {
        // Initial loading state before config is loaded from storage
        return <div className="flex items-center justify-center h-full text-[--text-muted]">Loading settings...</div>;
    }

    switch(view) {
        case 'settings':
            return <SettingsPanel 
                config={config} 
                onConfigChange={(newConfig) => {
                  handleConfigChange(newConfig);
                  setView('chat');
                }} 
                isConnecting={isLoadingModels}
                isElectron={isElectron}
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
             if (currentChatModelId) {
                 return (
                    <ChatView
                        modelId={currentChatModelId}
                        messages={messages.filter(m => m.role !== 'system')}
                        onSendMessage={handleSendMessage}
                        isResponding={isResponding}
                        onBack={handleBackToSelection}
                        theme={config.theme || 'dark'}
                        isElectron={isElectron}
                        projects={config.projects || []}
                        prefilledInput={prefilledInput}
                        onPrefillConsumed={onPrefillConsumed}
                    />
                );
             }
             return (
                <div className="h-full overflow-y-auto bg-[--bg-primary]">
                    <ModelSelector
                        models={models}
                        onSelectModel={handleSelectModel}
                        isLoading={isLoadingModels}
                        error={error}
                    />
                </div>
            );
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      {runOutput && <RunOutputModal runOutput={runOutput} onClose={() => setRunOutput(null)} />}
      <header className="flex items-center justify-between p-2 border-b border-[--border-primary] bg-[--bg-secondary]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold px-2">{APP_NAME}</h1>
            <nav className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
              <NavButton active={view === 'chat'} onClick={() => setView('chat')} ariaLabel="Chat View">
                <MessageSquareIcon className="w-4 h-4" />
                <span>Chat</span>
              </NavButton>
              <NavButton active={view === 'projects'} onClick={() => setView('projects')} ariaLabel="Projects View">
                <CodeIcon className="w-4 h-4" />
                <span>Projects</span>
              </NavButton>
               <NavButton active={view === 'api'} onClick={() => setView('api')} ariaLabel="API Client View">
                <ServerIcon className="w-4 h-4" />
                <span>API Client</span>
              </NavButton>
              <NavButton active={view === 'settings'} onClick={() => setView('settings')} ariaLabel="Settings View">
                 <SettingsIcon className="w-4 h-4" />
                <span>Settings</span>
              </NavButton>
              <NavButton active={view === 'info'} onClick={() => setView('info')} ariaLabel="Info View">
                <InfoIcon className="w-4 h-4" />
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
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
      {isLogPanelVisible && <LoggingPanel onClose={() => setIsLogPanelVisible(false)} />}
    </div>
  );
};

export default App;
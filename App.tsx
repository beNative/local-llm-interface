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
import FileTextIcon from './components/icons/FileTextIcon';
import SettingsIcon from './components/icons/SettingsIcon';
import InfoIcon from './components/icons/InfoIcon';
import MessageSquareIcon from './components/icons/MessageSquareIcon';
import CodeIcon from './components/icons/CodeIcon';

type View = 'chat' | 'settings' | 'info' | 'projects';

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
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' 
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
  }`}>
    {children}
  </button>
);


const App: React.FC = () => {
  const [config, setConfig] = useState<Config>({ 
    provider: 'Ollama', 
    baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
    theme: 'dark',
    logToFile: false,
    pythonProjectsPath: '',
    nodejsProjectsPath: '',
    projects: [],
  });
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<View>('chat');
  const [currentChatModelId, setCurrentChatModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [isElectron, setIsElectron] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(false);

  useEffect(() => {
    logger.info('App initialized.');
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [config.theme]);

  useEffect(() => {
    const loadInitialData = async () => {
      logger.debug('Loading initial data and settings.');
      const defaultConfig: Config = { 
        provider: 'Ollama', 
        baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
        theme: 'dark',
        logToFile: false,
        pythonProjectsPath: '',
        nodejsProjectsPath: '',
        projects: [],
      };
      
      let finalConfig = defaultConfig;

      if (window.electronAPI) {
        setIsElectron(true);
        logger.info('Electron environment detected.');
        const loadedSettings = await window.electronAPI.getSettings();
        if (loadedSettings) {
          logger.info('Loaded settings from file.');
          logger.debug(`Settings loaded: ${JSON.stringify(loadedSettings)}`);
          finalConfig = { ...defaultConfig, ...loadedSettings, projects: loadedSettings.projects || [] };
        } else {
          logger.info('No settings file found, using defaults.');
        }
      } else {
        logger.info('Running in browser environment.');
        const localSettings = localStorage.getItem('llm_config');
        if (localSettings) {
          try {
            const loadedSettings = JSON.parse(localSettings);
            logger.info('Loaded settings from localStorage.');
            logger.debug(`Settings loaded: ${JSON.stringify(loadedSettings)}`);
            finalConfig = { ...defaultConfig, ...loadedSettings, projects: loadedSettings.projects || [] };
          } catch (e) {
             logger.error("Failed to parse local settings, using defaults.");
          }
        } else {
            logger.info('No settings found in localStorage, using defaults.');
        }
      }
      
      setConfig(finalConfig);
      logger.setConfig({ logToFile: finalConfig.logToFile });
    };
    loadInitialData();
  }, []);

  const handleConfigChange = async (newConfig: Config) => {
    logger.info('Configuration change requested.');
    logger.debug(`New config: ${JSON.stringify(newConfig)}`);
    const needsModelReload = newConfig.baseUrl !== config.baseUrl || newConfig.provider !== config.provider;
    
    // Ensure projects is always an array
    const finalConfig = { ...newConfig, projects: newConfig.projects || [] };
    setConfig(finalConfig);

    logger.setConfig({ logToFile: finalConfig.logToFile });
    
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(finalConfig);
      logger.info('Settings saved to file.');
    } else {
      localStorage.setItem('llm_config', JSON.stringify(finalConfig));
      logger.info('Settings saved to localStorage.');
    }
    
    if (needsModelReload && view !== 'settings') {
      logger.info('Provider or Base URL changed, resetting to model selection.');
      setCurrentChatModelId(null); 
      setMessages([]);
      setView('chat');
    }
  };

  const handleThemeToggle = () => {
      const newTheme = config.theme === 'light' ? 'dark' : 'light';
      logger.info(`Theme toggled to ${newTheme}.`);
      handleConfigChange({ ...config, theme: newTheme });
  };

  const loadModels = useCallback(async () => {
    if (!config.baseUrl) {
        const msg = "The Base URL is not configured. Please check your settings.";
        logger.warn(msg);
        setError(msg);
        setModels([]);
        setIsLoadingModels(false);
        return;
    }
    setIsLoadingModels(true);
    setError(null);
    try {
      const fetchedModels = await fetchModels(config.baseUrl);
      setModels(fetchedModels);
      if (fetchedModels.length === 0) {
        logger.warn('Successfully connected, but no models were found.');
      } else {
        logger.info(`Successfully fetched ${fetchedModels.length} models.`);
      }
    } catch (err) {
      if (err instanceof LLMServiceError) {
        setError(err.message);
      } else {
        const msg = 'An unexpected error occurred while fetching models.';
        logger.error(msg);
        setError(msg);
      }
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [config.baseUrl]);

  useEffect(() => {
    // Load models if we are on the chat tab and no model is selected yet.
    if (view === 'chat' && !currentChatModelId) {
      loadModels();
    }
  }, [view, currentChatModelId, loadModels]);

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
    setView('chat');
  };

  const handleSendMessage = async (userInput: string) => {
    if (!currentChatModelId) return;

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
  
  const renderContent = () => {
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
            return <InfoView />;
        case 'projects':
            return <ProjectsView 
                config={config}
                onConfigChange={handleConfigChange}
                isElectron={isElectron}
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
                    />
                );
             }
             return (
                <div className="h-full overflow-y-auto bg-white dark:bg-gray-900">
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
      <header className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold px-2">{APP_NAME}</h1>
            <nav className="flex items-center gap-1 bg-gray-200/50 dark:bg-gray-700/50 p-1 rounded-lg">
              <NavButton active={view === 'chat'} onClick={() => setView('chat')} ariaLabel="Chat View">
                <MessageSquareIcon className="w-4 h-4" />
                <span>Chat</span>
              </NavButton>
              <NavButton active={view === 'projects'} onClick={() => setView('projects')} ariaLabel="Projects View">
                <CodeIcon className="w-4 h-4" />
                <span>Projects</span>
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
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800 focus:ring-blue-500"
            aria-label="Toggle logs panel"
            >
             <FileTextIcon className="w-5 h-5" />
            </button>
          <ThemeSwitcher theme={config.theme || 'dark'} onToggle={handleThemeToggle} />
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
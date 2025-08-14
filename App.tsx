
import React, { useState, useEffect, useCallback } from 'react';
import type { Config, Model, ChatMessage, Theme } from './types';
import { APP_NAME, PROVIDER_CONFIGS, DEFAULT_SYSTEM_PROMPT } from './constants';
import { fetchModels, streamChatCompletion, LLMServiceError } from './services/llmService';
import SettingsPanel from './components/SettingsPanel';
import ModelSelector from './components/ModelSelector';
import ChatView from './components/ChatView';
import ThemeSwitcher from './components/ThemeSwitcher';

const App: React.FC = () => {
  const [config, setConfig] = useState<Config>({ 
    provider: 'Ollama', 
    baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
    theme: 'dark' 
  });
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentChatModelId, setCurrentChatModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (config.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [config.theme]);

  useEffect(() => {
    const loadInitialData = async () => {
      const defaultConfig: Config = { 
        provider: 'Ollama', 
        baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl,
        theme: 'dark' 
      };
      
      let finalConfig = defaultConfig;

      // Check for electron environment and load settings
      if (window.electronAPI) {
        setIsElectron(true);
        const packaged = await window.electronAPI.isPackaged();
        console.log(`Running in Electron. Packaged: ${packaged}`);
        const loadedSettings = await window.electronAPI.getSettings();
        if (loadedSettings) {
          finalConfig = { ...defaultConfig, ...loadedSettings };
        }
      } else {
        const localSettings = localStorage.getItem('llm_config');
        if (localSettings) {
          try {
            const loadedSettings = JSON.parse(localSettings);
            finalConfig = { ...defaultConfig, ...loadedSettings };
          } catch (e) {
             console.error("Failed to parse local settings, using defaults.", e);
          }
        }
      }
      
      setConfig(finalConfig);
    };
    loadInitialData();
  }, []);

  const handleConfigChange = async (newConfig: Config) => {
    setConfig(newConfig);
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(newConfig);
    } else {
      localStorage.setItem('llm_config', JSON.stringify(newConfig));
    }
    // Only reset chat if provider or URL changes, not for theme changes
    if (newConfig.baseUrl !== config.baseUrl || newConfig.provider !== config.provider) {
      setCurrentChatModelId(null); 
      setMessages([]);
    }
  };

  const handleThemeToggle = () => {
      const newTheme = config.theme === 'light' ? 'dark' : 'light';
      const newConfig: Config = { ...config, theme: newTheme };
      handleConfigChange(newConfig);
  };

  const loadModels = useCallback(async () => {
    if (!config.baseUrl) {
        setError("The Base URL is not configured. Please check your settings.");
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
      if (err instanceof LLMServiceError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
      setModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [config.baseUrl]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSelectModel = (modelId: string) => {
    setCurrentChatModelId(modelId);
    setMessages([{ role: 'system', content: DEFAULT_SYSTEM_PROMPT }]);
  };

  const handleBackToSelection = () => {
    setCurrentChatModelId(null);
    setMessages([]);
  };

  const handleSendMessage = async (userInput: string) => {
    if (!currentChatModelId) return;

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
        console.error('Streaming Error:', err);
        const errorMsg: ChatMessage = { role: 'assistant', content: `Sorry, an error occurred: ${err.message}` };
        setMessages(prev => [...prev.slice(0,-1), errorMsg]);
        setIsResponding(false);
      },
      () => {
        setIsResponding(false);
      }
    );
  };
  
  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
        <div className="flex items-center gap-4">
          <SettingsPanel 
            config={config} 
            onConfigChange={handleConfigChange} 
            isConnecting={isLoadingModels}
          />
          <ThemeSwitcher theme={config.theme || 'dark'} onToggle={handleThemeToggle} />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {currentChatModelId ? (
          <ChatView
            modelId={currentChatModelId}
            messages={messages.filter(m => m.role !== 'system')}
            onSendMessage={handleSendMessage}
            isResponding={isResponding}
            onBack={handleBackToSelection}
            theme={config.theme || 'dark'}
            isElectron={isElectron}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            <ModelSelector
              models={models}
              onSelectModel={handleSelectModel}
              isLoading={isLoadingModels}
              error={error}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

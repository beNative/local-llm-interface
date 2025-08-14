import React, { useState, useEffect, useCallback } from 'react';
import type { Config, Model, ChatMessage } from './types.ts';
import { APP_NAME, PROVIDER_CONFIGS, DEFAULT_SYSTEM_PROMPT } from './constants.ts';
import { fetchModels, streamChatCompletion, LLMServiceError } from './services/llmService.ts';
import SettingsPanel from './components/SettingsPanel.tsx';
import ModelSelector from './components/ModelSelector.tsx';
import ChatView from './components/ChatView.tsx';

const App: React.FC = () => {
  const [config, setConfig] = useState<Config>({ provider: 'Ollama', baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl });
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentChatModelId, setCurrentChatModelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState<boolean>(false);

  useEffect(() => {
    const loadSettings = async () => {
      const defaultConfig = { provider: 'Ollama', baseUrl: PROVIDER_CONFIGS.Ollama.baseUrl } as Config;
      let loadedConfig: Config | null = null;
      
      if (window.electronAPI) {
        loadedConfig = await window.electronAPI.getSettings().catch(e => {
            console.error("Error loading settings from Electron:", e);
            return null;
        });
      } else {
        const localSettings = localStorage.getItem('llm_config');
        if (localSettings) {
            try {
                loadedConfig = JSON.parse(localSettings);
            } catch (e) {
                console.error("Error parsing settings from localStorage:", e);
            }
        }
      }
      setConfig(loadedConfig || defaultConfig);
    };
    loadSettings();
  }, []);

  const handleConfigChange = async (newConfig: Config) => {
    setConfig(newConfig);
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(newConfig);
    } else {
      localStorage.setItem('llm_config', JSON.stringify(newConfig));
    }
    setCurrentChatModelId(null); // Reset chat when config changes
    setMessages([]);
  };

  const loadModels = useCallback(async () => {
    // Prevent fetching if base url is not set
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
    <div className="flex flex-col h-screen font-sans bg-gray-900 text-white">
      <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <h1 className="text-xl font-bold">{APP_NAME}</h1>
        <SettingsPanel 
          config={config} 
          onConfigChange={handleConfigChange} 
          isConnecting={isLoadingModels}
        />
      </header>
      <main className="flex-1 overflow-hidden">
        {currentChatModelId ? (
          <ChatView
            modelId={currentChatModelId}
            messages={messages.filter(m => m.role !== 'system')}
            onSendMessage={handleSendMessage}
            isResponding={isResponding}
            onBack={handleBackToSelection}
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
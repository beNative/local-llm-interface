import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Config, LLMProvider } from '../types';
import { PROVIDER_CONFIGS } from '../constants';
import SettingsIcon from './icons/SettingsIcon';
import OllamaIcon from './icons/OllamaIcon';
import LMStudioIcon from './icons/LMStudioIcon';

interface SettingsPanelProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isConnecting: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, isConnecting }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as LLMProvider;
    setLocalConfig({
      provider,
      baseUrl: PROVIDER_CONFIGS[provider]?.baseUrl || '',
    });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig({ ...localConfig, baseUrl: e.target.value });
  };

  const handleSave = () => {
    onConfigChange(localConfig);
    setIsOpen(false);
  };
  
  const getProviderIcon = (provider: LLMProvider) => {
    switch (provider) {
      case 'Ollama':
        return <OllamaIcon className="w-5 h-5" />;
      case 'LMStudio':
        return <LMStudioIcon className="w-5 h-5" />;
      default:
        return <SettingsIcon className="w-5 h-5" />;
    }
  };

  const providerDescriptions: Record<LLMProvider, string> = {
    Ollama: 'Connect to a running Ollama instance. The default URL is usually correct.',
    LMStudio: 'Connect to the local server in LM Studio. Find the URL in the Server tab.',
    Custom: 'For any other OpenAI-compatible API endpoint.'
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-md p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
          <SettingsIcon className="w-8 h-8"/>
          Connection Settings
        </h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-400 mb-1">
              LLM Provider
            </label>
            <select
              id="provider"
              value={localConfig.provider}
              onChange={handleProviderChange}
              className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Ollama">Ollama</option>
              <option value="LMStudio">LMStudio</option>
              <option value="Custom">Custom</option>
            </select>
            <p className="text-xs text-gray-400 mt-2 px-1">
              {providerDescriptions[localConfig.provider]}
            </p>
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-400 mb-1">
              Base URL (v1 compatible)
            </label>
            <input
              type="text"
              id="baseUrl"
              value={localConfig.baseUrl}
              onChange={handleUrlChange}
              className="w-full px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., http://localhost:11434/v1"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
           <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isConnecting}
            className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Save & Refresh'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {getProviderIcon(config.provider)}
        <span>{config.provider}</span>
      </button>

      {isOpen && ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
};

export default SettingsPanel;
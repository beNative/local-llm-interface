
import React, { useState, useEffect } from 'react';
import type { Config, LLMProvider } from '../types';
import { PROVIDER_CONFIGS } from '../constants';
import SettingsIcon from './icons/SettingsIcon';

interface SettingsPanelProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isConnecting: boolean;
  isElectron: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, isConnecting, isElectron }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as LLMProvider;
    setLocalConfig(current => ({
      ...current,
      provider,
      baseUrl: PROVIDER_CONFIGS[provider]?.baseUrl || '',
    }));
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig({ ...localConfig, baseUrl: e.target.value });
  };
  
  const handleLogToFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig({ ...localConfig, logToFile: e.target.checked });
  };

  const handlePythonCommandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig({ ...localConfig, pythonCommand: e.target.value });
  };

  const handleSave = () => {
    onConfigChange(localConfig);
  };
  
  const providerDescriptions: Record<LLMProvider, string> = {
    Ollama: 'Connect to a running Ollama instance. The default URL is usually correct.',
    LMStudio: 'Connect to the local server in LM Studio. Find the URL in the Server tab.',
    Custom: 'For any other OpenAI-compatible API endpoint.'
  };

  return (
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white mb-8">
          <SettingsIcon className="w-8 h-8"/>
          Settings
        </h1>
        
        <div className="space-y-8 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">Connection</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="provider" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    LLM Provider
                    </label>
                    <select
                    id="provider"
                    value={localConfig.provider}
                    onChange={handleProviderChange}
                    className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <option value="Ollama">Ollama</option>
                    <option value="LMStudio">LMStudio</option>
                    <option value="Custom">Custom</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
                    {providerDescriptions[localConfig.provider]}
                    </p>
                </div>
                <div>
                    <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Base URL (v1 compatible)
                    </label>
                    <input
                    type="text"
                    id="baseUrl"
                    value={localConfig.baseUrl}
                    onChange={handleUrlChange}
                    className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., http://localhost:11434/v1"
                    />
                </div>
            </div>
          </div>
            
          {isElectron && (
            <div>
                 <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">Advanced</h3>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!localConfig.logToFile}
                            onChange={handleLogToFileChange}
                            className="w-4 h-4 rounded text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Automatically save logs to file
                        </span>
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 px-1">
                        Saves logs to a file in the app directory. Useful for debugging.
                    </p>
                    
                    <div>
                        <label htmlFor="pythonCommand" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Python Command
                        </label>
                        <input
                            type="text"
                            id="pythonCommand"
                            value={localConfig.pythonCommand || ''}
                            onChange={handlePythonCommandChange}
                            className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., python or python3"
                        />
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
                            The command to execute Python scripts (e.g., 'python', 'python3', or a full path).
                        </p>
                    </div>
                </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={handleSave}
            disabled={isConnecting}
            className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 focus:ring-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Save & Refresh Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
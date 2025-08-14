
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
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-primary]">
      <div className="max-w-2xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-[--text-primary] mb-8">
          <SettingsIcon className="w-8 h-8"/>
          Settings
        </h1>
        
        <div className="space-y-8 bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
          <div>
            <h3 className="text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Connection</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="provider" className="block text-sm font-medium text-[--text-muted] mb-1">
                    LLM Provider
                    </label>
                    <select
                    id="provider"
                    value={localConfig.provider}
                    onChange={handleProviderChange}
                    className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                    >
                    <option value="Ollama">Ollama</option>
                    <option value="LMStudio">LMStudio</option>
                    <option value="Custom">Custom</option>
                    </select>
                    <p className="text-xs text-[--text-muted] mt-2 px-1">
                    {providerDescriptions[localConfig.provider]}
                    </p>
                </div>
                <div>
                    <label htmlFor="baseUrl" className="block text-sm font-medium text-[--text-muted] mb-1">
                    Base URL (v1 compatible)
                    </label>
                    <input
                    type="text"
                    id="baseUrl"
                    value={localConfig.baseUrl}
                    onChange={handleUrlChange}
                    className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                    placeholder="e.g., http://localhost:11434/v1"
                    />
                </div>
            </div>
          </div>
            
          {isElectron && (
            <div>
                 <h3 className="text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Advanced</h3>
                <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!localConfig.logToFile}
                            onChange={handleLogToFileChange}
                            className="w-4 h-4 rounded text-blue-600 bg-[--bg-tertiary] border-[--border-secondary] focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-[--text-muted]">
                            Automatically save logs to file
                        </span>
                    </label>
                    <p className="text-xs text-[--text-muted] -mt-2 px-1">
                        Saves logs to a file in the app directory. Useful for debugging.
                    </p>
                    
                    <div>
                        <label htmlFor="pythonCommand" className="block text-sm font-medium text-[--text-muted] mb-1">
                            Python Command
                        </label>
                        <input
                            type="text"
                            id="pythonCommand"
                            value={localConfig.pythonCommand || ''}
                            onChange={handlePythonCommandChange}
                            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            placeholder="e.g., python or python3"
                        />
                         <p className="text-xs text-[--text-muted] mt-2 px-1">
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
            className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--bg-accent] rounded-md hover:bg-[--bg-accent-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus] disabled:bg-[--bg-accent-disabled] disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Save & Refresh Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
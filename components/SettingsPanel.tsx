
import React, { useState, useEffect } from 'react';
import type { Config, LLMProvider, ThemeOverrides } from '../types';
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
  
  const handleThemeOverrideChange = (key: keyof ThemeOverrides, value: string | number) => {
    setLocalConfig(current => ({
        ...current,
        themeOverrides: {
            ...current.themeOverrides,
            [key]: value
        }
    }));
  };

  const handleResetThemeOverrides = () => {
    setLocalConfig(current => ({
        ...current,
        themeOverrides: {}
    }));
  };

  const handleSave = () => {
    onConfigChange(localConfig);
  };
  
  const providerDescriptions: Record<LLMProvider, string> = {
    Ollama: 'Connect to a running Ollama instance. The default URL is usually correct.',
    LMStudio: 'Connect to the local server in LM Studio. Find the URL in the Server tab.',
    Custom: 'For any other OpenAI-compatible API endpoint.'
  };
  
  const themeOverrides = localConfig.themeOverrides || {};

  return (
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-primary]">
      <div className="max-w-2xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-[--text-primary] mb-8">
          <SettingsIcon className="w-8 h-8"/>
          Settings
        </h1>
        
        <div className="space-y-8">
            <div className="bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
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
            
            <div className="bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
              <div className="flex justify-between items-center mb-4 border-b border-[--border-primary] pb-3">
                <h3 className="text-lg font-semibold text-[--text-secondary]">Appearance</h3>
                <button
                    onClick={handleResetThemeOverrides}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800"
                >
                    Reset Appearance
                </button>
              </div>
               <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ColorInput label="Chat Background" value={themeOverrides.chatBg || ''} onChange={v => handleThemeOverrideChange('chatBg', v)} />
                      <ColorInput label="User Message BG" value={themeOverrides.userMessageBg || ''} onChange={v => handleThemeOverrideChange('userMessageBg', v)} />
                      <ColorInput label="User Message Text" value={themeOverrides.userMessageColor || ''} onChange={v => handleThemeOverrideChange('userMessageColor', v)} />
                      <ColorInput label="Assistant Message BG" value={themeOverrides.assistantMessageBg || ''} onChange={v => handleThemeOverrideChange('assistantMessageBg', v)} />
                      <ColorInput label="Assistant Message Text" value={themeOverrides.assistantMessageColor || ''} onChange={v => handleThemeOverrideChange('assistantMessageColor', v)} />
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                       <div>
                            <label htmlFor="font-family" className="block text-sm font-medium text-[--text-muted] mb-1">
                                Font Family
                            </label>
                            <select
                                id="font-family"
                                value={themeOverrides.fontFamily || 'sans-serif'}
                                onChange={e => handleThemeOverrideChange('fontFamily', e.target.value)}
                                className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            >
                                <option value="sans-serif">Sans-serif</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Monospace</option>
                            </select>
                       </div>
                       <div>
                             <label htmlFor="font-size" className="block text-sm font-medium text-[--text-muted] mb-1">
                                Font Size (px)
                            </label>
                            <input
                                type="number"
                                id="font-size"
                                value={themeOverrides.fontSize || 16}
                                onChange={e => handleThemeOverrideChange('fontSize', e.target.valueAsNumber)}
                                className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-md focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                                placeholder="16"
                            />
                       </div>
                   </div>
               </div>
            </div>
              
            {isElectron && (
              <div className="bg-[--bg-secondary]/50 p-6 rounded-lg border border-[--border-primary]">
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


const ColorInput: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-[--text-muted] mb-1">{label}</label>
        <div className="flex items-center gap-2 px-2 border border-[--border-secondary] rounded-md bg-[--bg-tertiary] focus-within:ring-2 focus-within:ring-[--border-focus]">
            <input
                type="color"
                value={value || '#000000'}
                onChange={e => onChange(e.target.value)}
                className="w-6 h-6 p-0 bg-transparent border-none cursor-pointer"
            />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full py-2 bg-transparent text-[--text-primary] focus:outline-none"
                placeholder="e.g., #ffffff"
            />
        </div>
    </div>
);


export default SettingsPanel;
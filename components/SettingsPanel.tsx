
import React, { useState, useEffect, useMemo } from 'react';
import type { Config, LLMProvider, Theme, ThemeOverrides, PredefinedPrompt } from '../types';
import { PROVIDER_CONFIGS } from '../constants';
import SettingsIcon from './icons/SettingsIcon';
import TrashIcon from './icons/TrashIcon';

interface SettingsPanelProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isConnecting: boolean;
  isElectron: boolean;
  theme: Theme;
}

const PREDEFINED_COLORS = [
  // Grayscale
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a',
  // Accent Colors
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const ColorSelector: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-[--text-muted] mb-2">{label}</label>
        <div className="flex flex-wrap gap-2">
            {PREDEFINED_COLORS.map(color => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-[--bg-secondary] ring-[--border-focus] border-[--border-focus]' : 'border-transparent hover:border-[--border-secondary]'}`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                    title={color}
                />
            ))}
        </div>
    </div>
);


const PreviewBox: React.FC<{ label: string; bgColor: string; textColor: string;}> = ({ label, bgColor, textColor }) => (
    <div>
        <h4 className="text-sm font-medium text-[--text-muted] mb-2">{label}</h4>
        <div
            style={{ backgroundColor: bgColor, color: textColor }}
            className="p-3 rounded-lg border border-[--border-secondary] transition-colors"
        >
            <p className="font-semibold">Aa Bb Cc</p>
            <p className="text-xs opacity-90">This is a preview of the message style.</p>
        </div>
    </div>
);

const NewPromptForm: React.FC<{ onAdd: (title: string, content: string) => void }> = ({ onAdd }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onAdd(title, content);
      setTitle('');
      setContent('');
    };

    return (
      <form onSubmit={handleSubmit} className="pt-4 border-t border-[--border-primary] space-y-3">
        <h4 className="text-md font-semibold text-[--text-secondary]">Add New Prompt</h4>
        <div>
          <label htmlFor="prompt-title" className="block text-sm font-medium text-[--text-muted] mb-1">Title</label>
          <input
            id="prompt-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
            placeholder="e.g., Refactor Python Code"
            required
          />
        </div>
        <div>
          <label htmlFor="prompt-content" className="block text-sm font-medium text-[--text-muted] mb-1">Content</label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
            placeholder="e.g., Please refactor the following Python code to be more idiomatic and efficient."
            rows={3}
            required
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400"
            disabled={!title.trim() || !content.trim()}
          >
            Add Prompt
          </button>
        </div>
      </form>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, isConnecting, isElectron, theme }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);
  
  const defaults = useMemo(() => {
      if (typeof window === 'undefined') {
          return { chatBg: '', userMessageBg: '', userMessageColor: '', assistantMessageBg: '', assistantMessageColor: '' };
      }
      const rootStyle = getComputedStyle(document.documentElement);
      const getCssVar = (name: string) => rootStyle.getPropertyValue(name).trim();
      return {
          chatBg: getCssVar('--bg-primary'),
          userMessageBg: getCssVar('--bg-accent'),
          userMessageColor: getCssVar('--text-on-accent'),
          assistantMessageBg: getCssVar('--bg-secondary'),
          assistantMessageColor: getCssVar('--text-primary'),
      };
  }, [theme]);

  const themeOverrides = localConfig.themeOverrides || {};

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

  const handleAddPrompt = (title: string, content: string) => {
    if (!title.trim() || !content.trim()) return;
    const newPrompt: PredefinedPrompt = {
      id: `prompt_${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
    };
    setLocalConfig(current => ({
      ...current,
      predefinedPrompts: [...(current.predefinedPrompts || []), newPrompt],
    }));
  };

  const handleDeletePrompt = (promptId: string) => {
    setLocalConfig(current => ({
      ...current,
      predefinedPrompts: (current.predefinedPrompts || []).filter(p => p.id !== promptId),
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

  return (
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-secondary]">
      <div className="max-w-2xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold mb-8" style={{ color: 'var(--accent-settings)'}}>
          <SettingsIcon className="w-8 h-8"/>
          Settings
        </h1>
        
        <div className="space-y-8">
            <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
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
                      className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
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
                      className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                      placeholder="e.g., http://localhost:11434/v1"
                      />
                  </div>
              </div>
            </div>

            <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
              <h3 className="text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Predefined Prompts</h3>
              <div className="space-y-4">
                {(localConfig.predefinedPrompts || []).length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {(localConfig.predefinedPrompts || []).map(prompt => (
                      <div key={prompt.id} className="flex items-start justify-between gap-4 p-3 bg-[--bg-secondary] rounded-lg border border-[--border-secondary]">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[--text-primary] truncate">{prompt.title}</p>
                          <p className="text-sm text-[--text-muted] mt-1 whitespace-pre-wrap font-mono break-words">{prompt.content}</p>
                        </div>
                        <button
                          onClick={() => handleDeletePrompt(prompt.id)}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0"
                          aria-label="Delete prompt"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center text-[--text-muted] py-4">You have no saved prompts yet.</p>
                )}

                <NewPromptForm onAdd={handleAddPrompt} />
              </div>
            </div>
            
            <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b border-[--border-primary] pb-3">
                <h3 className="text-lg font-semibold text-[--text-secondary]">Appearance</h3>
                <button
                    onClick={handleResetThemeOverrides}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800"
                >
                    Reset Appearance
                </button>
              </div>
              <div className="space-y-6">
                <div>
                   <ColorSelector 
                      label="Chat Background" 
                      value={themeOverrides.chatBg || defaults.chatBg}
                      onChange={v => handleThemeOverrideChange('chatBg', v)} 
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                    <PreviewBox 
                      label="User Message Preview"
                      bgColor={themeOverrides.userMessageBg || defaults.userMessageBg}
                      textColor={themeOverrides.userMessageColor || defaults.userMessageColor}
                    />
                    <ColorSelector 
                      label="Background Color" 
                      value={themeOverrides.userMessageBg || defaults.userMessageBg}
                      onChange={v => handleThemeOverrideChange('userMessageBg', v)} />
                    <ColorSelector 
                      label="Text Color" 
                      value={themeOverrides.userMessageColor || defaults.userMessageColor}
                      onChange={v => handleThemeOverrideChange('userMessageColor', v)} />
                  </div>

                  <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                    <PreviewBox 
                      label="Assistant Message Preview"
                      bgColor={themeOverrides.assistantMessageBg || defaults.assistantMessageBg}
                      textColor={themeOverrides.assistantMessageColor || defaults.assistantMessageColor}
                    />
                    <ColorSelector 
                      label="Background Color" 
                      value={themeOverrides.assistantMessageBg || defaults.assistantMessageBg}
                      onChange={v => handleThemeOverrideChange('assistantMessageBg', v)} />
                    <ColorSelector 
                      label="Text Color" 
                      value={themeOverrides.assistantMessageColor || defaults.assistantMessageColor}
                      onChange={v => handleThemeOverrideChange('assistantMessageColor', v)} />
                  </div>
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
                            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
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
                            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            placeholder="16"
                        />
                   </div>
                </div>
              </div>
            </div>
              
            {isElectron && (
              <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
                   <h3 className="text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Advanced</h3>
                  <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                          <input
                              type="checkbox"
                              checked={!!localConfig.logToFile}
                              onChange={handleLogToFileChange}
                              className="w-4 h-4 rounded text-indigo-600 bg-[--bg-tertiary] border-[--border-secondary] focus:ring-indigo-500"
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
                              className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
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
            className="flex items-center justify-center px-6 py-2.5 text-sm font-medium text-[--text-on-accent] bg-[--accent-settings] rounded-lg hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[--bg-primary] focus:ring-[--border-focus] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Save & Refresh Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
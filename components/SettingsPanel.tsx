

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Config, LLMProvider, Theme, ThemeOverrides, PredefinedPrompt, ColorOverrides, SystemPrompt, ToolchainStatus, Toolchain } from '../types';
import { PROVIDER_CONFIGS } from '../constants';
import SettingsIcon from './icons/SettingsIcon';
import TrashIcon from './icons/TrashIcon';
import IdentityIcon from './icons/IdentityIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface SettingsPanelProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
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

const NewPromptForm: React.FC<{ 
    onAdd: (title: string, content: string) => void;
    heading: string;
    titlePlaceholder: string;
    contentPlaceholder: string;
    idPrefix: string;
    buttonText: string;
}> = ({ onAdd, heading, titlePlaceholder, contentPlaceholder, idPrefix, buttonText }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onAdd(title, content);
      setTitle('');
      setContent('');
    };
    
    const titleId = `${idPrefix}-title`;
    const contentId = `${idPrefix}-content`;

    return (
      <form onSubmit={handleSubmit} className="pt-4 border-t border-[--border-primary] space-y-3">
        <h4 className="text-md font-semibold text-[--text-secondary]">{heading}</h4>
        <div>
          <label htmlFor={titleId} className="block text-sm font-medium text-[--text-muted] mb-1">Title</label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
            placeholder={titlePlaceholder}
            required
          />
        </div>
        <div>
          <label htmlFor={contentId} className="block text-sm font-medium text-[--text-muted] mb-1">Content</label>
          <textarea
            id={contentId}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
            placeholder={contentPlaceholder}
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
            {buttonText}
          </button>
        </div>
      </form>
    );
};

const ToolchainSelector: React.FC<{
  label: string;
  toolchains: Toolchain[];
  selectedValue: string | undefined;
  onChange: (newValue: string) => void;
  isLoading: boolean;
}> = ({ label, toolchains, selectedValue, onChange, isLoading }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-[--text-muted] mb-1">{label}</label>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[--text-muted]">
          <SpinnerIcon className="w-4 h-4" />
          <span>Scanning for installations...</span>
        </div>
      ) : (
        <select
          value={selectedValue || 'default'}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
        >
          <option value="default">System Default (from PATH)</option>
          {toolchains.length > 0 && <option disabled>--- Detected ---</option>}
          {toolchains.map(tool => (
            <option key={tool.path} value={tool.path} title={tool.path}>
              {tool.name} ({tool.path})
            </option>
          ))}
        </select>
      )}
      {toolchains.length === 0 && !isLoading && (
        <p className="text-xs text-[--text-muted] mt-1 px-1">No installations detected automatically. The system default will be used.</p>
      )}
    </div>
  );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, isElectron, theme }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);
  const [activeAppearanceTab, setActiveAppearanceTab] = useState<Theme>(theme);
  const [toolchains, setToolchains] = useState<ToolchainStatus | null>(null);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const isUpdatingFromProps = useRef(true);
  
  useEffect(() => {
    if (isElectron) {
      setIsLoadingTools(true);
      window.electronAPI!.detectToolchains()
        .then(setToolchains)
        .catch(e => console.error("Failed to detect toolchains", e))
        .finally(() => setIsLoadingTools(false));
    }
  }, [isElectron]);


  useEffect(() => {
    isUpdatingFromProps.current = true;
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    if (isUpdatingFromProps.current) {
        isUpdatingFromProps.current = false;
        return;
    }
    const handler = setTimeout(() => {
        onConfigChange(localConfig);
    }, 500);
    return () => clearTimeout(handler);
  }, [localConfig, onConfigChange]);
  
  const defaults = useMemo(() => ({
    light: {
        chatBg: '#f8fafc',
        userMessageBg: '#4f46e5',
        userMessageColor: '#ffffff',
        assistantMessageBg: '#f1f5f9',
        assistantMessageColor: '#1e293b',
    },
    dark: {
        chatBg: '#1e293b',
        userMessageBg: '#818cf8',
        userMessageColor: '#1e293b',
        assistantMessageBg: '#334155',
        assistantMessageColor: '#f8fafc',
    }
  }), []);

  const activeThemeDefaults = activeAppearanceTab === 'dark' ? defaults.dark : defaults.light;
  const themeOverrides = localConfig.themeOverrides || {};
  const activeColorOverrides = (activeAppearanceTab === 'dark' ? themeOverrides.dark : themeOverrides.light) || {};

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
  
  const handleToolchainChange = (key: keyof Config, value: string) => {
    const finalValue = value === 'default' ? undefined : value;
    setLocalConfig(current => ({...current, [key]: finalValue }));
  };
  
  const handleColorOverrideChange = (key: keyof ColorOverrides, value: string) => {
    setLocalConfig(current => ({
        ...current,
        themeOverrides: {
            ...current.themeOverrides,
            [activeAppearanceTab]: {
                ...current.themeOverrides?.[activeAppearanceTab],
                [key]: value
            }
        }
    }));
  };

  const handleFontOverrideChange = (key: 'fontFamily' | 'fontSize', value: string | number) => {
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
        themeOverrides: {
            ...current.themeOverrides,
            [activeAppearanceTab]: {},
        }
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
  
  const handleAddSystemPrompt = (title: string, content: string) => {
    if (!title.trim() || !content.trim()) return;
    const newPrompt: SystemPrompt = {
      id: `system_prompt_${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
    };
    setLocalConfig(current => ({
      ...current,
      systemPrompts: [...(current.systemPrompts || []), newPrompt],
    }));
  };

  const handleDeleteSystemPrompt = (promptId: string) => {
    setLocalConfig(current => ({
      ...current,
      systemPrompts: (current.systemPrompts || []).filter(p => p.id !== promptId),
    }));
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
        
        <div className="space-y-8 pb-8">
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

                <NewPromptForm 
                    onAdd={handleAddPrompt}
                    heading="Add New Prompt"
                    titlePlaceholder="e.g., Refactor Python Code"
                    contentPlaceholder="e.g., Please refactor the following Python code to be more idiomatic and efficient."
                    idPrefix="predefined-prompt"
                    buttonText="Add Prompt"
                />
              </div>
            </div>

            <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">
                <IdentityIcon className="w-5 h-5" />
                System Prompts (Personas)
              </h3>
              <div className="space-y-4">
                {(localConfig.systemPrompts || []).length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {(localConfig.systemPrompts || []).map(prompt => (
                      <div key={prompt.id} className="flex items-start justify-between gap-4 p-3 bg-[--bg-secondary] rounded-lg border border-[--border-secondary]">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[--text-primary] truncate">{prompt.title}</p>
                          <p className="text-sm text-[--text-muted] mt-1 whitespace-pre-wrap font-mono break-words">{prompt.content}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteSystemPrompt(prompt.id)}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0"
                          aria-label="Delete system prompt"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-center text-[--text-muted] py-4">You have no saved system prompts yet.</p>
                )}

                 <NewPromptForm 
                    onAdd={handleAddSystemPrompt}
                    heading="Add New System Prompt"
                    titlePlaceholder="e.g., Senior DevOps Engineer"
                    contentPlaceholder="e.g., You are a senior DevOps engineer with 20 years of experience..."
                    idPrefix="system-prompt"
                    buttonText="Add System Prompt"
                />
              </div>
            </div>
            
            <div className="bg-[--bg-primary] p-6 rounded-xl border border-[--border-primary] shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b border-[--border-primary] pb-3">
                <h3 className="text-lg font-semibold text-[--text-secondary]">Appearance</h3>
                <button
                    onClick={handleResetThemeOverrides}
                    className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800"
                >
                    Reset {activeAppearanceTab === 'light' ? 'Light' : 'Dark'} Theme Colors
                </button>
              </div>

              <div className="border-b border-[--border-primary]">
                  <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                      <button
                          onClick={() => setActiveAppearanceTab('light')}
                          className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeAppearanceTab === 'light' ? 'border-[--border-focus] text-[--text-primary]' : 'border-transparent text-[--text-muted] hover:border-gray-400'}`}
                      >
                          Light Theme
                      </button>
                      <button
                          onClick={() => setActiveAppearanceTab('dark')}
                          className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeAppearanceTab === 'dark' ? 'border-[--border-focus] text-[--text-primary]' : 'border-transparent text-[--text-muted] hover:border-gray-400'}`}
                      >
                          Dark Theme
                      </button>
                  </nav>
              </div>

              <div className="space-y-6 pt-6">
                <div>
                   <ColorSelector 
                      label="Chat Background" 
                      value={activeColorOverrides.chatBg || activeThemeDefaults.chatBg}
                      onChange={v => handleColorOverrideChange('chatBg', v)} 
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                    <PreviewBox 
                      label="User Message Preview"
                      bgColor={activeColorOverrides.userMessageBg || activeThemeDefaults.userMessageBg}
                      textColor={activeColorOverrides.userMessageColor || activeThemeDefaults.userMessageColor}
                    />
                    <ColorSelector 
                      label="Background Color" 
                      value={activeColorOverrides.userMessageBg || activeThemeDefaults.userMessageBg}
                      onChange={v => handleColorOverrideChange('userMessageBg', v)} />
                    <ColorSelector 
                      label="Text Color" 
                      value={activeColorOverrides.userMessageColor || activeThemeDefaults.userMessageColor}
                      onChange={v => handleColorOverrideChange('userMessageColor', v)} />
                  </div>

                  <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                    <PreviewBox 
                      label="Assistant Message Preview"
                      bgColor={activeColorOverrides.assistantMessageBg || activeThemeDefaults.assistantMessageBg}
                      textColor={activeColorOverrides.assistantMessageColor || activeThemeDefaults.assistantMessageColor}
                    />
                    <ColorSelector 
                      label="Background Color" 
                      value={activeColorOverrides.assistantMessageBg || activeThemeDefaults.assistantMessageBg}
                      onChange={v => handleColorOverrideChange('assistantMessageBg', v)} />
                    <ColorSelector 
                      label="Text Color" 
                      value={activeColorOverrides.assistantMessageColor || activeThemeDefaults.assistantMessageColor}
                      onChange={v => handleColorOverrideChange('assistantMessageColor', v)} />
                  </div>
                </div>
              </div>

              <div className="border-t border-[--border-primary] mt-6 pt-6">
                <h4 className="text-md font-semibold text-[--text-secondary] mb-4">Font Settings (Global)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                        <label htmlFor="font-family" className="block text-sm font-medium text-[--text-muted] mb-1">
                            Font Family
                        </label>
                        <select
                            id="font-family"
                            value={themeOverrides.fontFamily || 'sans-serif'}
                            onChange={e => handleFontOverrideChange('fontFamily', e.target.value)}
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
                            onChange={e => handleFontOverrideChange('fontSize', e.target.valueAsNumber)}
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
                      <div className="space-y-4">
                        <h4 className="text-md font-semibold text-[--text-secondary]">Toolchains</h4>
                        <p className="text-xs text-[--text-muted] -mt-2 px-1">
                          Configure the specific compilers and interpreters to use for creating and running projects.
                        </p>
                        <ToolchainSelector
                          label="Python Interpreter"
                          isLoading={isLoadingTools}
                          toolchains={toolchains?.python || []}
                          selectedValue={localConfig.selectedPythonPath}
                          onChange={(v) => handleToolchainChange('selectedPythonPath', v)}
                        />
                        <ToolchainSelector
                          label="Java Development Kit (JDK)"
                          isLoading={isLoadingTools}
                          toolchains={toolchains?.java || []}
                          selectedValue={localConfig.selectedJavaPath}
                          onChange={(v) => handleToolchainChange('selectedJavaPath', v)}
                        />
                         <ToolchainSelector
                          label="Node.js Executable"
                          isLoading={isLoadingTools}
                          toolchains={toolchains?.nodejs || []}
                          selectedValue={localConfig.selectedNodePath}
                          onChange={(v) => handleToolchainChange('selectedNodePath', v)}
                        />
                         <ToolchainSelector
                          label="Delphi/RAD Studio Compiler"
                          isLoading={isLoadingTools}
                          toolchains={toolchains?.delphi || []}
                          selectedValue={localConfig.selectedDelphiPath}
                          onChange={(v) => handleToolchainChange('selectedDelphiPath', v)}
                        />
                      </div>
                      <div className="pt-4 border-t border-[--border-primary]">
                        <h4 className="text-md font-semibold text-[--text-secondary]">Logging</h4>
                        <label className="flex items-center gap-3 cursor-pointer mt-2">
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
                        <p className="text-xs text-[--text-muted] mt-1 px-1">
                            Saves logs to a file in the app directory. Useful for debugging.
                        </p>
                      </div>
                  </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
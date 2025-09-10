import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Config, LLMProviderConfig, Theme, ThemeOverrides, PredefinedPrompt, ColorOverrides, SystemPrompt, ToolchainStatus, Toolchain, IconSet, LLMProviderType } from '../types';
import Icon from './Icon';
import { DEFAULT_PROVIDERS } from '../constants';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';
import { useToast } from '../hooks/useToast';

interface SettingsPanelProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isElectron: boolean;
  theme: Theme;
}

type SettingsSection = 'general' | 'personalization' | 'content' | 'advanced';

const PREDEFINED_COLORS = [
  // Grayscale
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#1e293b', '#0f172a',
  // Accent Colors
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const iconSets: IconSet[] = ['default', 'lucide', 'heroicons', 'feather', 'fontawesome', 'material'];
const densities: ThemeOverrides['density'][] = ['compact', 'normal', 'comfortable'];

const ProviderEditorModal: React.FC<{
  provider: LLMProviderConfig | null;
  onClose: () => void;
  onSave: (provider: LLMProviderConfig) => void;
}> = ({ provider, onClose, onSave }) => {
    const [name, setName] = useState(provider?.name || '');
    const [baseUrl, setBaseUrl] = useState(provider?.baseUrl || '');
    const [requiresApiKey, setRequiresApiKey] = useState(!!provider?.apiKeyName);
    const [apiKeyName, setApiKeyName] = useState(provider?.apiKeyName || '');

    const handleSave = () => {
        if (!name.trim() || !baseUrl.trim() || (requiresApiKey && !apiKeyName.trim())) {
            alert('Please fill in all required fields.');
            return;
        }
        onSave({
            id: provider?.id || `custom_${Date.now()}`,
            name: name.trim(),
            baseUrl: baseUrl.trim(),
            type: 'openai-compatible', // Currently only support adding openai-compatible custom providers
            apiKeyName: requiresApiKey ? apiKeyName.trim() : undefined,
            isCustom: true,
        });
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[--text-primary] mb-4">{provider ? 'Edit' : 'Add'} Custom Provider</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[--text-muted] mb-1">Provider Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg" placeholder="e.g., My GLM Server" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[--text-muted] mb-1">Base URL (v1 compatible)</label>
                        <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg" placeholder="http://localhost:8000/v1" />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer mt-2">
                        <input type="checkbox" checked={requiresApiKey} onChange={e => setRequiresApiKey(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 bg-[--bg-tertiary] border-[--border-secondary]" />
                        <span className="text-sm font-medium text-[--text-muted]">Requires API Key</span>
                    </label>
                    {requiresApiKey && (
                        <div>
                            <label className="block text-sm font-medium text-[--text-muted] mb-1">API Key Field Name</label>
                            <input type="text" value={apiKeyName} onChange={e => setApiKeyName(e.target.value)} className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg" placeholder="e.g., MY_GLM_API_KEY" />
                            <p className="text-xs text-[--text-muted] mt-1 px-1">This is the internal name used to store the key. The actual key is entered in the API Keys section.</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover]">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">Save Provider</button>
                </div>
            </div>
        </div>
    );
};


const ColorSelector: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-sm font-medium text-[--text-muted] mb-2">{label}</label>
        <div className="flex flex-wrap gap-2">
            {PREDEFINED_COLORS.map(color => {
                const tooltipProps = useTooltipTrigger(color);
                return (
                    <button
                        key={color}
                        type="button"
                        {...tooltipProps}
                        onClick={() => onChange(color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-[--bg-secondary] ring-[--border-focus] border-[--border-focus]' : 'border-transparent hover:border-[--border-secondary]'}`}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                    />
                )
            })}
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
          <Icon name="spinner" className="w-4 h-4" />
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

interface NavButtonProps {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}
const NavButton: React.FC<NavButtonProps> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 text-left px-[var(--space-3)] py-[var(--space-2)] rounded-lg text-[length:var(--font-size-sm)] font-medium transition-colors ${
            isActive
                ? 'bg-[--accent-settings]/10 dark:bg-[--accent-settings]/20 text-[--accent-settings]'
                : 'text-[--text-secondary] hover:bg-[--bg-hover]'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const StatusIndicator: React.FC<{ status: 'online' | 'offline' | 'checking' | 'unknown' }> = ({ status }) => {
    const statusConfig = {
        online: { text: 'Online', color: 'bg-green-500', icon: null },
        offline: { text: 'Offline', color: 'bg-red-500', icon: null },
        checking: { text: 'Checking...', color: 'bg-yellow-500', icon: <Icon name="spinner" className="w-3 h-3 text-yellow-800 dark:text-yellow-200" /> },
        unknown: { text: 'Unknown', color: 'bg-gray-400', icon: null },
    };

    const { text, color, icon } = statusConfig[status];

    return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-[--text-muted]">
            {icon ? icon : <div className={`w-2 h-2 rounded-full ${color}`} />}
            <span>{text}</span>
        </div>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, onConfigChange, isElectron, theme }) => {
  const [localConfig, setLocalConfig] = useState<Config>(config);
  const [activeAppearanceTab, setActiveAppearanceTab] = useState<Theme>(theme);
  const [toolchains, setToolchains] = useState<ToolchainStatus | null>(null);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [editingProvider, setEditingProvider] = useState<LLMProviderConfig | null>(null);
  const [isAddingProvider, setIsAddingProvider] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, 'online' | 'offline' | 'checking' | 'unknown'>>({});
  const isUpdatingFromProps = useRef(true);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const { addToast } = useToast();
  const jsonEditorRef = useRef<HTMLDivElement>(null);
  
  const checkProviderStatus = async (providerId: string, baseUrl: string) => {
      if (!window.electronAPI) return;
      setProviderStatuses(prev => ({ ...prev, [providerId]: 'checking' }));
      try {
          const isOnline = await window.electronAPI.checkProviderHealth(baseUrl);
          setProviderStatuses(prev => ({ ...prev, [providerId]: isOnline ? 'online' : 'offline' }));
      } catch (e) {
          setProviderStatuses(prev => ({ ...prev, [providerId]: 'offline' }));
      }
  };

  useEffect(() => {
    if (isElectron && activeSection === 'general') {
        const allProviders = localConfig.providers || [];
        allProviders.forEach(p => {
            if (!providerStatuses[p.id] || providerStatuses[p.id] === 'unknown') {
                checkProviderStatus(p.id, p.baseUrl);
            }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isElectron, activeSection, localConfig.providers]);

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
    setJsonText(JSON.stringify(config, null, 2));
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
  
  const handleSelectProvider = (providerId: string) => {
    setLocalConfig(current => ({ ...current, selectedProviderId: providerId }));
  };
  
  const handleSaveProvider = (providerToSave: LLMProviderConfig) => {
    setLocalConfig(current => {
      const providers = current.providers ? [...current.providers] : [];
      const existingIndex = providers.findIndex(p => p.id === providerToSave.id);
      if (existingIndex > -1) {
        providers[existingIndex] = providerToSave;
      } else {
        providers.push(providerToSave);
      }
      return { ...current, providers };
    });
    setEditingProvider(null);
    setIsAddingProvider(false);
  };

  const handleDeleteProvider = (providerId: string) => {
    if (!confirm('Are you sure you want to delete this custom provider?')) return;
    setLocalConfig(current => {
      const providers = (current.providers || []).filter(p => p.id !== providerId);
      let selectedProviderId = current.selectedProviderId;
      // If the deleted provider was the active one, select the first provider in the list
      if (selectedProviderId === providerId) {
        selectedProviderId = providers[0]?.id;
      }
      return { ...current, providers, selectedProviderId };
    });
  };

  const handleSimpleConfigChange = (key: keyof Config, value: any) => {
    setLocalConfig(current => ({ ...current, [key]: value }));
  };

  const handleApiKeyChange = (key: string, value: string) => {
    setLocalConfig(current => ({
        ...current,
        apiKeys: {
            ...current.apiKeys,
            [key]: value
        }
    }));
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

  const handleThemeOverridesChange = (key: keyof ThemeOverrides, value: any) => {
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

  const handleExportSettings = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.exportSettings(localConfig);
    if (!result.success) {
        alert(`Failed to export settings: ${result.error}`);
    }
  };

  const handleImportSettings = async () => {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.importSettings();
      if (result.error) {
          alert(`Failed to import settings: ${result.error}`);
          return;
      }
      if (result.success && result.content) {
          try {
              const importedConfig = JSON.parse(result.content);
              onConfigChange(importedConfig);
              alert('Settings imported successfully. The app will now use the new configuration.');
          } catch (e) {
              alert(`Failed to parse imported settings file. It might be invalid JSON. Error: ${e instanceof Error ? e.message : String(e)}`);
          }
      }
  };

  const handleSaveJson = () => {
      try {
          const parsedConfig = JSON.parse(jsonText);
          setJsonError(null);
          onConfigChange(parsedConfig);
      } catch (e) {
          const error = e instanceof Error ? e.message : 'Invalid JSON';
          setJsonError(error);
      }
  };

  const handleJsonEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (jsonEditorRef.current) {
          const pre = jsonEditorRef.current.querySelector('pre');
          if (pre) {
              pre.scrollTop = e.currentTarget.scrollTop;
              pre.scrollLeft = e.currentTarget.scrollLeft;
          }
      }
  };

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) return;
    setIsCheckingForUpdates(true);
    addToast({ type: 'info', message: 'Checking for updates...', duration: 2000 });
    try {
        await window.electronAPI.checkForUpdates();
    } catch (error) {
        // The global listener in App.tsx will show a more detailed toast
        console.error("Update check failed to initiate:", error);
    } finally {
        // The global listeners in App.tsx will provide final status toasts
        // (e.g., "up to date" or "downloading"). We'll just stop the spinner here.
        setTimeout(() => setIsCheckingForUpdates(false), 2000); // Give time for other toasts to appear
    }
  };

  const navItems: { id: SettingsSection; label: string; icon: React.ReactNode; isVisible: boolean }[] = [
      { id: 'general', label: 'General', icon: <Icon name="sliders" className="w-5 h-5"/>, isVisible: true },
      { id: 'personalization', label: 'Personalization', icon: <Icon name="palette" className="w-5 h-5"/>, isVisible: true },
      { id: 'content', label: 'Content', icon: <Icon name="bookmark" className="w-5 h-5"/>, isVisible: true },
      { id: 'advanced', label: 'Advanced', icon: <Icon name="cpu" className="w-5 h-5"/>, isVisible: isElectron },
  ];

  const uniqueApiProviders = useMemo(() => {
    const seenKeys = new Set<string>();
    return (localConfig.providers || []).filter(p => {
        if (p.apiKeyName && !seenKeys.has(p.apiKeyName)) {
            seenKeys.add(p.apiKeyName);
            return true;
        }
        return false;
    });
  }, [localConfig.providers]);
  
  const refreshTooltip = useTooltipTrigger('Refresh status');

  const renderContent = () => {
      switch (activeSection) {
          case 'general':
              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {(editingProvider || isAddingProvider) && (
                    <ProviderEditorModal
                      provider={editingProvider}
                      onClose={() => { setEditingProvider(null); setIsAddingProvider(false); }}
                      onSave={handleSaveProvider}
                    />
                  )}
                  <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                    <h3 className="text-xl font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Connection</h3>
                    <div className="space-y-3">
                        {(localConfig.providers || []).map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                                <input 
                                    type="radio" 
                                    name="selectedProvider" 
                                    id={`provider-radio-${p.id}`}
                                    checked={localConfig.selectedProviderId === p.id}
                                    onChange={() => handleSelectProvider(p.id)}
                                    className="w-4 h-4 text-indigo-600 bg-[--bg-tertiary] border-[--border-secondary] focus:ring-indigo-500"
                                />
                                <label htmlFor={`provider-radio-${p.id}`} className="cursor-pointer min-w-0">
                                    <p className="font-semibold text-[--text-primary] truncate">{p.name}</p>
                                    <p className="text-xs text-[--text-muted] font-mono truncate">{p.baseUrl}</p>
                                </label>
                                <div className="flex-grow" />
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isElectron && (p.baseUrl.includes('localhost') || p.baseUrl.includes('127.0.0.1')) && (
                                        <>
                                            <StatusIndicator status={providerStatuses[p.id] || 'unknown'} />
                                            <button 
                                                {...refreshTooltip} 
                                                onClick={() => checkProviderStatus(p.id, p.baseUrl)} 
                                                disabled={(providerStatuses[p.id] || 'unknown') === 'checking'}
                                                className="p-2 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                <Icon name="refresh" className={`w-4 h-4 ${(providerStatuses[p.id] || 'unknown') === 'checking' ? 'animate-spin' : ''}`} />
                                            </button>
                                        </>
                                    )}
                                    {p.isCustom && (
                                        <div className="flex items-center gap-1 border-l border-[--border-secondary] pl-2">
                                            <button onClick={() => setEditingProvider(p)} className="p-2 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full"><Icon name="settings" className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteProvider(p.id)} className="p-2 text-[--text-muted] hover:text-red-500 hover:bg-red-500/10 rounded-full"><Icon name="trash" className="w-4 h-4"/></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <button 
                            onClick={() => { setEditingProvider(null); setIsAddingProvider(true); }} 
                            className="w-full flex items-center justify-center gap-2 text-sm text-[--text-secondary] hover:text-[--text-primary] bg-[--bg-tertiary] hover:bg-[--bg-hover] border border-[--border-secondary] rounded-lg py-2"
                        >
                            <Icon name="plus" className="w-4 h-4" /> Add Custom Provider
                        </button>
                    </div>
                  </div>
                  <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                        <h3 className="text-xl font-semibold text-[--text-secondary] mb-4">API Keys</h3>
                        <div className="space-y-4">
                            {uniqueApiProviders.map(p => (
                                <div key={p.apiKeyName}>
                                    <label htmlFor={`api-key-${p.apiKeyName}`} className="block text-sm font-medium text-[--text-muted] mb-1">API Key for {p.name}</label>
                                    <input 
                                        type="password"
                                        id={`api-key-${p.apiKeyName}`}
                                        value={localConfig.apiKeys?.[p.apiKeyName!] || ''}
                                        onChange={e => handleApiKeyChange(p.apiKeyName!, e.target.value)}
                                        className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                                        placeholder={`Enter your ${p.name} key here...`}
                                    />
                                    <p className="text-xs text-[--text-muted] mt-1 px-1">Your key is stored locally and never sent to any third party.</p>
                                </div>
                            ))}
                            {uniqueApiProviders.length === 0 && (
                               <p className="text-sm text-[--text-muted]">The selected provider does not require an API key.</p>
                            )}
                        </div>
                  </div>
                  {isElectron && (
                    <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm xl:col-span-2 space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold text-[--text-secondary] mb-4">Logging</h3>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={!!localConfig.logToFile} onChange={(e) => handleSimpleConfigChange('logToFile', e.target.checked)} className="w-4 h-4 rounded text-indigo-600 bg-[--bg-tertiary] border-[--border-secondary] focus:ring-indigo-500" />
                                <span className="text-sm font-medium text-[--text-muted]">Automatically save logs to file</span>
                            </label>
                            <p className="text-xs text-[--text-muted] mt-1 px-1">Saves logs to a file in the app directory. Useful for debugging.</p>
                        </div>
                         <div className="pt-6 border-t border-[--border-primary]">
                            <h3 className="text-xl font-semibold text-[--text-secondary] mb-4">Updates</h3>
                             <div className="flex items-center gap-4">
                                <button
                                    onClick={handleCheckForUpdates}
                                    disabled={isCheckingForUpdates}
                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover] disabled:opacity-60 disabled:cursor-wait"
                                >
                                    {isCheckingForUpdates ? <Icon name="spinner" className="w-5 h-5"/> : <Icon name="downloadCloud" className="w-5 h-5"/>}
                                    {isCheckingForUpdates ? 'Checking...' : 'Check for Updates'}
                                </button>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!localConfig.allowPrerelease}
                                        onChange={(e) => handleSimpleConfigChange('allowPrerelease', e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 bg-[--bg-tertiary] border-[--border-secondary] focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-[--text-muted]">Receive pre-release versions</span>
                                </label>
                            </div>
                            <p className="text-xs text-[--text-muted] mt-2 px-1">Get early access to new features. Pre-releases may be unstable.</p>
                        </div>
                    </div>
                  )}
                </div>
              );
          case 'personalization':
              return (
                 <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b border-[--border-primary] pb-3">
                        <h3 className="text-xl font-semibold text-[--text-secondary]">Appearance</h3>
                        <button onClick={handleResetThemeOverrides} className="px-3 py-1 text-xs font-medium text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800">
                            Reset {activeAppearanceTab === 'light' ? 'Light' : 'Dark'} Theme Colors
                        </button>
                    </div>
                    <div className="border-b border-[--border-primary]">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button onClick={() => setActiveAppearanceTab('light')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeAppearanceTab === 'light' ? 'border-[--border-focus] text-[--text-primary]' : 'border-transparent text-[--text-muted] hover:border-gray-400'}`}>Light Theme</button>
                            <button onClick={() => setActiveAppearanceTab('dark')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeAppearanceTab === 'dark' ? 'border-[--border-focus] text-[--text-primary]' : 'border-transparent text-[--text-muted] hover:border-gray-400'}`}>Dark Theme</button>
                        </nav>
                    </div>
                    <div className="pt-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 space-y-6">
                            <div>
                                <ColorSelector label="Chat Background" value={activeColorOverrides.chatBg || activeThemeDefaults.chatBg} onChange={v => handleColorOverrideChange('chatBg', v)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                                    <PreviewBox label="User Message Preview" bgColor={activeColorOverrides.userMessageBg || activeThemeDefaults.userMessageBg} textColor={activeColorOverrides.userMessageColor || activeThemeDefaults.userMessageColor} />
                                    <ColorSelector label="Background Color" value={activeColorOverrides.userMessageBg || activeThemeDefaults.userMessageBg} onChange={v => handleColorOverrideChange('userMessageBg', v)} />
                                    <ColorSelector label="Text Color" value={activeColorOverrides.userMessageColor || activeThemeDefaults.userMessageColor} onChange={v => handleColorOverrideChange('userMessageColor', v)} />
                                </div>
                                <div className="space-y-4 p-4 rounded-lg border border-[--border-secondary] bg-[--bg-secondary]">
                                    <PreviewBox label="Assistant Message Preview" bgColor={activeColorOverrides.assistantMessageBg || activeThemeDefaults.assistantMessageBg} textColor={activeColorOverrides.assistantMessageColor || activeThemeDefaults.assistantMessageColor} />
                                    <ColorSelector label="Background Color" value={activeColorOverrides.assistantMessageBg || activeThemeDefaults.assistantMessageBg} onChange={v => handleColorOverrideChange('assistantMessageBg', v)} />
                                    <ColorSelector label="Text Color" value={activeColorOverrides.assistantMessageColor || activeThemeDefaults.assistantMessageColor} onChange={v => handleColorOverrideChange('assistantMessageColor', v)} />
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-6 lg:border-l lg:pl-6 lg:border-[--border-primary]">
                            <h4 className="text-md font-semibold text-[--text-secondary] mb-2">Interface Customization (Global)</h4>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label htmlFor="font-family" className="block text-sm font-medium text-[--text-muted] mb-1">Font Family</label>
                                    <select id="font-family" value={themeOverrides.fontFamily || 'sans-serif'} onChange={e => handleThemeOverridesChange('fontFamily', e.target.value)} className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]">
                                        <option value="sans-serif" style={{ fontFamily: 'sans-serif' }}>System Default</option>
                                        <option value="serif" style={{ fontFamily: 'serif' }}>Serif</option>
                                        <option value="monospace" style={{ fontFamily: 'monospace' }}>Monospace</option>
                                        <option value="Verdana, Geneva, Tahoma, sans-serif" style={{ fontFamily: 'Verdana, Geneva, Tahoma, sans-serif' }}>Verdana</option>
                                        <option value="Georgia, Cambria, 'Times New Roman', Times, serif" style={{ fontFamily: "Georgia, Cambria, 'Times New Roman', Times, serif" }}>Georgia</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="font-size" className="block text-sm font-medium text-[--text-muted] mb-1">Font Size (px)</label>
                                    <input type="number" id="font-size" value={themeOverrides.fontSize || 16} onChange={e => handleThemeOverridesChange('fontSize', e.target.valueAsNumber)} className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]" placeholder="16"/>
                                </div>
                                <div>
                                    <label htmlFor="app-scale" className="flex justify-between text-sm font-medium text-[--text-muted] mb-1">
                                        <span>Application Scale</span>
                                        <span className="font-mono">{(themeOverrides.scale || 100)}%</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        id="app-scale" 
                                        min="50" max="400" step="5" 
                                        value={themeOverrides.scale || 100} 
                                        onChange={e => handleThemeOverridesChange('scale', e.target.valueAsNumber)}
                                        className="w-full h-2 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[--text-muted] mb-2">Control Density</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {densities.map(d => (
                                            <button
                                                key={d}
                                                onClick={() => handleThemeOverridesChange('density', d)}
                                                className={`px-3 py-2 text-sm rounded-lg border-2 transition-all text-center ${
                                                    (themeOverrides.density || 'normal') === d
                                                        ? 'bg-[--accent-settings]/20 border-[--accent-settings] font-semibold text-[--accent-settings]'
                                                        : 'bg-[--bg-tertiary] border-transparent hover:border-[--border-secondary] text-[--text-secondary]'
                                                }`}
                                            >
                                                {d.charAt(0).toUpperCase() + d.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[--text-muted] mb-2">Icon Set</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {iconSets.map(set => {
                                        const setName = set === 'fontawesome' ? 'Font Awesome' : set === 'material' ? 'Material' : set.charAt(0).toUpperCase() + set.slice(1);
                                        return (
                                            <button
                                                key={set}
                                                onClick={() => handleThemeOverridesChange('iconSet', set as IconSet)}
                                                className={`px-3 py-2 text-sm rounded-lg border-2 transition-all text-center ${
                                                    (themeOverrides.iconSet || 'default') === set
                                                        ? 'bg-[--accent-settings]/20 border-[--accent-settings] font-semibold text-[--accent-settings]'
                                                        : 'bg-[--bg-tertiary] border-transparent hover:border-[--border-secondary] text-[--text-secondary]'
                                                }`}
                                            >
                                                {setName}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
              );
          case 'content':
              return (
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                        <h3 className="text-xl font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Predefined Prompts</h3>
                        <div className="space-y-4">
                            {(localConfig.predefinedPrompts || []).length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {(localConfig.predefinedPrompts || []).map(prompt => (
                                        <div key={prompt.id} className="flex items-start justify-between gap-4 p-3 bg-[--bg-secondary] rounded-lg border border-[--border-secondary]">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-[--text-primary] truncate">{prompt.title}</p>
                                                <p className="text-sm text-[--text-muted] mt-1 whitespace-pre-wrap font-mono break-words">{prompt.content}</p>
                                            </div>
                                            <button onClick={() => handleDeletePrompt(prompt.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0" aria-label="Delete prompt"><Icon name="trash" className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : ( <p className="text-sm text-center text-[--text-muted] py-4">You have no saved prompts yet.</p> )}
                            <NewPromptForm onAdd={handleAddPrompt} heading="Add New Prompt" titlePlaceholder="e.g., Refactor Python Code" contentPlaceholder="e.g., Please refactor the following Python code to be more idiomatic and efficient." idPrefix="predefined-prompt" buttonText="Add Prompt" />
                        </div>
                    </div>
                    <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3"><Icon name="identity" className="w-5 h-5" /> System Prompts (Personas)</h3>
                        <div className="space-y-4">
                            {(localConfig.systemPrompts || []).length > 0 ? (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {(localConfig.systemPrompts || []).map(prompt => (
                                        <div key={prompt.id} className="flex items-start justify-between gap-4 p-3 bg-[--bg-secondary] rounded-lg border border-[--border-secondary]">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-[--text-primary] truncate">{prompt.title}</p>
                                                <p className="text-sm text-[--text-muted] mt-1 whitespace-pre-wrap font-mono break-words">{prompt.content}</p>
                                            </div>
                                            <button onClick={() => handleDeleteSystemPrompt(prompt.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0" aria-label="Delete system prompt"><Icon name="trash" className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            ) : ( <p className="text-sm text-center text-[--text-muted] py-4">You have no saved system prompts yet.</p> )}
                            <NewPromptForm onAdd={handleAddSystemPrompt} heading="Add New System Prompt" titlePlaceholder="e.g., Senior DevOps Engineer" contentPlaceholder="e.g., You are a senior DevOps engineer with 20 years of experience..." idPrefix="system-prompt" buttonText="Add System Prompt"/>
                        </div>
                    </div>
                 </div>
              );
          case 'advanced':
              return (
                <div>
                  <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                      <h3 className="text-xl font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Toolchains</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <p className="text-sm text-[--text-muted] -mt-2 sm:col-span-2">Configure the specific compilers and interpreters to use for creating and running projects.</p>
                        <ToolchainSelector label="Python Interpreter" isLoading={isLoadingTools} toolchains={toolchains?.python || []} selectedValue={localConfig.selectedPythonPath} onChange={(v) => handleToolchainChange('selectedPythonPath', v)} />
                        <ToolchainSelector label="Java Development Kit (JDK)" isLoading={isLoadingTools} toolchains={toolchains?.java || []} selectedValue={localConfig.selectedJavaPath} onChange={(v) => handleToolchainChange('selectedJavaPath', v)} />
                        <ToolchainSelector label="Node.js Executable" isLoading={isLoadingTools} toolchains={toolchains?.nodejs || []} selectedValue={localConfig.selectedNodePath} onChange={(v) => handleToolchainChange('selectedNodePath', v)} />
                        <ToolchainSelector label="Delphi/RAD Studio Compiler" isLoading={isLoadingTools} toolchains={toolchains?.delphi || []} selectedValue={localConfig.selectedDelphiPath} onChange={(v) => handleToolchainChange('selectedDelphiPath', v)} />
                      </div>
                  </div>
                  <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm mt-6">
                        <h3 className="text-xl font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">Raw Settings File (settings.json)</h3>
                        <div className="space-y-4">
                            <p className="text-sm text-[--text-muted]">
                                View and edit the raw JSON configuration. Be careful, as incorrect changes can break the application.
                            </p>
                            <div className="flex gap-2">
                                <button onClick={handleImportSettings} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover]">
                                    <Icon name="uploadCloud" className="w-4 h-4" /> Import...
                                </button>
                                <button onClick={handleExportSettings} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover]">
                                    <Icon name="downloadCloud" className="w-4 h-4" /> Export...
                                </button>
                            </div>

                            <div ref={jsonEditorRef} className="relative font-mono text-xs h-96 overflow-hidden rounded-[--border-radius]">
                                <SyntaxHighlighter
                                    language="json"
                                    style={theme === 'dark' ? atomDark : coy}
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                        // FIX: Use 'background' property instead of 'backgroundColor' to match the type from the theme object.
                                        background: (theme === 'dark' ? atomDark : coy)['pre[class*="language-"]']?.background || (theme === 'dark' ? '#2d2d2d' : '#f5f2f0'),
                                    }}
                                    codeTagProps={{ style: { fontFamily: 'inherit' } }}
                                >
                                    {`${jsonText}\n`}
                                </SyntaxHighlighter>
                                <textarea
                                    value={jsonText}
                                    onScroll={handleJsonEditorScroll}
                                    onChange={e => {
                                        setJsonText(e.target.value);
                                        if (jsonError) setJsonError(null);
                                    }}
                                    spellCheck="false"
                                    className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-[--text-primary] resize-none border-2 rounded-[--border-radius] focus:outline-none overflow-auto ${jsonError ? 'border-red-500 focus:ring-red-500/50' : 'border-transparent focus:ring-[--border-focus]'}`}
                                    style={{ fontFamily: 'inherit' }}
                                />
                            </div>

                            <div className="flex justify-end items-center gap-4">
                                {jsonError && <p className="text-sm text-red-500">Error: {jsonError}</p>}
                                <button onClick={handleSaveJson} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                                    Save JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
              );
      }
  }

  return (
    <div className="flex h-full overflow-hidden bg-[--bg-secondary]">
      <aside className="w-60 p-[var(--space-4)] border-r border-[--border-primary] overflow-y-auto flex-shrink-0 bg-[--bg-primary]">
        <h1 className="flex items-center gap-3 text-2xl font-bold mb-8 px-2" style={{ color: 'var(--accent-settings)'}}>
          <Icon name="settings" className="w-7 h-7"/>
          Settings
        </h1>
        <nav className="space-y-1">
            {navItems.filter(item => item.isVisible).map(item => (
                <NavButton 
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={activeSection === item.id}
                    onClick={() => setActiveSection(item.id)}
                />
            ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-[var(--space-6)]">
        {renderContent()}
      </main>
    </div>
  );
};

export default SettingsPanel;
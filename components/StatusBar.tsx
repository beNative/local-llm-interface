import React, { useState, useRef, useEffect } from 'react';
import OllamaIcon from './icons/OllamaIcon';
import LMStudioIcon from './icons/LMStudioIcon';
import OpenAIIcon from './icons/OpenAIIcon';
import GoogleGeminiIcon from './icons/GoogleGeminiIcon';
import Icon from './Icon';
import type { LLMProviderConfig, SystemStats, Model } from '../types';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';


interface StatusBarProps {
    stats: SystemStats | null;
    connectionStatus: 'connected' | 'connecting' | 'error';
    statusText: string;
    providers: LLMProviderConfig[];
    selectedProviderId: string | undefined;
    activeModel: string | null;
    activeProject: string | null;
    models: Model[];
    onSelectModel: (modelId: string) => void;
    onChangeProvider: (providerId: string) => void;
}

const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ProviderIcons: Record<string, React.FC<{className?: string}>> = {
  ollama: OllamaIcon,
  lmstudio: LMStudioIcon,
  openai: OpenAIIcon,
  'google-gemini': GoogleGeminiIcon,
};


const StatusBar: React.FC<StatusBarProps> = ({ stats, connectionStatus, statusText, providers, selectedProviderId, activeModel, activeProject, models, onSelectModel, onChangeProvider }) => {
    const [isProviderPopoverOpen, setIsProviderPopoverOpen] = useState(false);
    const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
    const providerRef = useRef<HTMLDivElement>(null);
    const modelRef = useRef<HTMLDivElement>(null);
    
    const activeProvider = providers.find(p => p.id === selectedProviderId);
    
    const providerTooltip = useTooltipTrigger(statusText);
    const modelTooltip = useTooltipTrigger("Select a model to start a new chat");
    const projectTooltip = useTooltipTrigger(`Active Project Context: ${activeProject}`);
    const cpuTooltip = useTooltipTrigger("System-wide CPU Usage");
    const gpuTooltip = useTooltipTrigger(stats?.gpu !== undefined && stats.gpu >= 0 ? `System-wide GPU Usage: ${stats.gpu.toFixed(0)}%` : "System-wide GPU Usage (N/A or Requires NVIDIA GPU)");
    const ramTooltip = useTooltipTrigger("System-wide RAM Usage");


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (providerRef.current && !providerRef.current.contains(event.target as Node)) {
                setIsProviderPopoverOpen(false);
            }
            if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
                setIsModelPopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const memUsagePercent = stats?.memory.total ? (stats.memory.used / stats.memory.total) * 100 : 0;
    const cpuUsagePercent = stats?.cpu || 0;
    const gpuUsagePercent = stats?.gpu !== undefined && stats.gpu >= 0 ? stats.gpu : 0;

    const statusDotClass =
        connectionStatus === 'connecting'
        ? 'bg-yellow-500 animate-pulse'
        : connectionStatus === 'error'
        ? 'bg-red-500'
        : 'bg-green-500';
    
    const ProviderIcon = activeProvider ? (ProviderIcons[activeProvider.id] || ((props: any) => <Icon name="server" {...props} />)) : ((props: any) => <Icon name="server" {...props} />);

    return (
        <footer className="flex items-center justify-between gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono flex-shrink-0">
            {/* Left Side */}
            <div className="flex items-center gap-4">
                 <div className="relative" ref={providerRef}>
                    <button {...providerTooltip} onClick={() => setIsProviderPopoverOpen(p => !p)} className="flex items-center gap-2 p-1 rounded hover:bg-[--bg-hover]">
                        <ProviderIcon className="w-4 h-4" />
                        <span className={`w-2 h-2 rounded-full ${statusDotClass}`}></span>
                        <span className="hidden sm:inline">{activeProvider?.name || 'No Provider'}</span>
                    </button>
                    {isProviderPopoverOpen && (
                         <div className="absolute bottom-full left-0 mb-2 w-48 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 overflow-hidden">
                            {providers.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        onChangeProvider(p.id);
                                        setIsProviderPopoverOpen(false);
                                    }}
                                    className="w-full text-left block px-3 py-2 text-sm font-sans text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-px h-4 bg-[--border-primary]" />
                 <div className="relative" ref={modelRef}>
                    <button {...modelTooltip} onClick={() => setIsModelPopoverOpen(p => !p)} className="flex items-center gap-2 p-1 rounded hover:bg-[--bg-hover]" disabled={models.length === 0}>
                        <Icon name="model" className="w-4 h-4" />
                        <span className="truncate max-w-48">{activeModel || (models.length > 0 ? 'Select Model' : 'No Models')}</span>
                    </button>
                    {isModelPopoverOpen && models.length > 0 && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                          <div className="p-2 text-xs font-semibold text-[--text-muted] border-b border-[--border-primary] font-sans">Start new chat with:</div>
                            {models.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => {
                                        onSelectModel(model.id);
                                        setIsModelPopoverOpen(false);
                                    }}
                                    className="w-full text-left block px-3 py-1.5 text-sm font-sans text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                                >
                                    {model.id}
                                </button>
                            ))}
                        </div>
                    )}
                 </div>
                  {activeProject && (
                    <>
                        <div className="w-px h-4 bg-[--border-primary]" />
                        <div {...projectTooltip} className="flex items-center gap-2 p-1">
                           <Icon name="code" className="w-4 h-4" />
                           <span className="truncate max-w-48">{activeProject}</span>
                        </div>
                    </>
                )}
            </div>
            
            {/* Right Side */}
            <div className="flex items-center gap-6">
                 <div {...cpuTooltip} className="flex items-center gap-2">
                    <Icon name="cpu" className="w-4 h-4" />
                     {stats ? (
                        <>
                            <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden hidden md:block">
                                <div className="h-full bg-[--accent-projects]" style={{ width: `${cpuUsagePercent}%` }}></div>
                            </div>
                            <span>{cpuUsagePercent.toFixed(0)}%</span>
                        </>
                    ) : (
                        <span>--%</span>
                    )}
                </div>
                <div {...gpuTooltip} className="flex items-center gap-2">
                    <Icon name="gpu" className="w-4 h-4" />
                     {stats && stats.gpu >= 0 ? (
                        <>
                            <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden hidden md:block">
                                <div className="h-full bg-[--accent-api]" style={{ width: `${gpuUsagePercent}%` }}></div>
                            </div>
                            <span>{gpuUsagePercent.toFixed(0)}%</span>
                        </>
                    ) : (
                        <span>--%</span>
                    )}
                </div>
                <div {...ramTooltip} className="flex items-center gap-2">
                    <Icon name="ram" className="w-4 h-4" />
                    {stats ? (
                        <>
                            <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden hidden md:block">
                                <div className="h-full bg-[--accent-info]" style={{ width: `${memUsagePercent}%` }}></div>
                            </div>
                            <span>{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</span>
                        </>
                    ) : (
                        <span>-- MB / -- GB</span>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default StatusBar;

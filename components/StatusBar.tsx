import React from 'react';
import OllamaIcon from './icons/OllamaIcon';
import LMStudioIcon from './icons/LMStudioIcon';
import Icon from './Icon';
import type { LLMProvider, SystemStats } from '../types';


interface StatusBarProps {
    stats: SystemStats | null;
    connectionStatus: 'connected' | 'connecting' | 'error';
    statusText: string;
    provider: LLMProvider;
    activeModel: string | null;
    activeProject: string | null;
}

const formatBytes = (bytes: number, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


const StatusBar: React.FC<StatusBarProps> = ({ stats, connectionStatus, statusText, provider, activeModel, activeProject }) => {
    const memUsagePercent = stats?.memory.total ? (stats.memory.used / stats.memory.total) * 100 : 0;
    const cpuUsagePercent = stats?.cpu || 0;

    const statusDotClass =
        connectionStatus === 'connecting'
        ? 'bg-yellow-500 animate-pulse'
        : connectionStatus === 'error'
        ? 'bg-red-500'
        : 'bg-green-500';
    
    const ProviderIcon = provider === 'Ollama' ? OllamaIcon : provider === 'LMStudio' ? LMStudioIcon : (props: any) => <Icon name="model" {...props} />;

    return (
        <footer className="flex items-center justify-between gap-6 px-4 py-1 bg-[--bg-primary] border-t border-[--border-primary] text-xs text-[--text-muted] font-mono flex-shrink-0">
            {/* Left Side */}
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2" title={statusText}>
                    <ProviderIcon className="w-4 h-4" />
                    <span className={`w-2 h-2 rounded-full ${statusDotClass}`}></span>
                    <span className="hidden sm:inline">{provider}</span>
                </div>
                { (activeModel || activeProject) && (
                    <>
                     <div className="w-px h-4 bg-[--border-primary]" />
                      {activeModel && (
                        <div className="flex items-center gap-2" title={`Active Model: ${activeModel}`}>
                            <Icon name="model" className="w-4 h-4" />
                            <span className="truncate max-w-48">{activeModel}</span>
                        </div>
                      )}
                      {activeProject && (
                        <div className="flex items-center gap-2" title={`Active Project Context: ${activeProject}`}>
                           <Icon name="code" className="w-4 h-4" />
                           <span className="truncate max-w-48">{activeProject}</span>
                        </div>
                      )}
                    </>
                )}
            </div>
            
            {/* Right Side */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2" title="System-wide GPU Usage (Not yet implemented)">
                    <Icon name="gpu" className="w-4 h-4" />
                    <span>{stats?.gpu !== undefined && stats.gpu >= 0 ? `${stats.gpu.toFixed(0)}%` : '--%'}</span>
                </div>
                <div className="flex items-center gap-2" title="System-wide RAM Usage">
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
                <div className="flex items-center gap-2" title="System-wide CPU Usage">
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
            </div>
        </footer>
    );
};

export default StatusBar;
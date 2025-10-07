import React, { useRef } from 'react';
import Icon from './Icon';
import ThemeSwitcher from './ThemeSwitcher';
import type { Theme } from '../types';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

const TitleBarNavButton: React.FC<{
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    view: View;
    title: string;
}> = ({ active, onClick, children, view, title }) => {
    const tooltipProps = useTooltipTrigger(title);
    return (
        <button
            onClick={onClick}
            aria-label={title}
            {...tooltipProps}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`focus-ring relative flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-200 ${
                active
                    ? `bg-[--accent-${view}]/10 text-[--accent-${view}]`
                    : 'text-[--text-muted] hover:bg-[--bg-hover]'
            }`}
        >
            {children}
        </button>
    );
};


interface TitleBarProps {
    activeView: View;
    onNavigate: (view: View) => void;
    onToggleLogs: () => void;
    onToggleTheme: () => void;
    theme: Theme;
    onOpenCommandPalette: (rect: DOMRect) => void;
    isMaximized: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ activeView, onNavigate, onToggleLogs, onToggleTheme, theme, onOpenCommandPalette, isMaximized }) => {
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const logsTooltip = useTooltipTrigger('Toggle logs panel');

    const handleMinimize = () => window.electronAPI?.minimizeWindow();
    const handleMaximize = () => isMaximized ? window.electronAPI?.unmaximizeWindow() : window.electronAPI?.maximizeWindow();
    const handleClose = () => window.electronAPI?.closeWindow();

    const handleSearchClick = () => {
        if (searchBoxRef.current) {
            onOpenCommandPalette(searchBoxRef.current.getBoundingClientRect());
        }
    };

    return (
        <div 
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            className="flex items-center justify-between h-9 bg-[--bg-primary] border-b border-[--border-primary] flex-shrink-0"
        >
            {/* Left side: App Icon and some space */}
            <div className="flex items-center gap-2 pl-2">
                 <Icon name="brainCircuit" className="w-5 h-5 text-[--accent-chat]" />
            </div>

            {/* Center: Search / Command Palette */}
            <div 
                ref={searchBoxRef}
                onClick={handleSearchClick}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="flex-grow max-w-xl mx-4"
            >
                <div className="flex items-center gap-2 px-3 py-1 bg-[--bg-tertiary] border border-[--border-secondary] rounded-md text-[--text-muted] text-sm cursor-pointer hover:bg-[--bg-hover] hover:border-[--border-focus] transition-colors">
                    <Icon name="search" className="w-4 h-4" />
                    <span>Search...</span>
                    <span className="ml-auto text-xs border border-[--border-secondary] rounded px-1.5 py-0.5 font-mono">
                        Cmd K
                    </span>
                </div>
            </div>
            
            {/* Right Side: Nav buttons and Window controls */}
            <div className="flex items-center h-full">
                <nav className="flex items-center gap-1 px-2">
                    <TitleBarNavButton active={activeView === 'chat'} onClick={() => onNavigate('chat')} view="chat" title="Chat">
                        <Icon name="messageSquare" className="w-4 h-4" /> 
                    </TitleBarNavButton>
                     <TitleBarNavButton active={activeView === 'projects'} onClick={() => onNavigate('projects')} view="projects" title="Projects">
                        <Icon name="code" className="w-4 h-4" /> 
                    </TitleBarNavButton>
                     <TitleBarNavButton active={activeView === 'api'} onClick={() => onNavigate('api')} view="api" title="API Client">
                        <Icon name="server" className="w-4 h-4" />
                    </TitleBarNavButton>
                    <TitleBarNavButton active={activeView === 'settings'} onClick={() => onNavigate('settings')} view="settings" title="Settings">
                        <Icon name="settings" className="w-4 h-4" />
                    </TitleBarNavButton>
                    <TitleBarNavButton active={activeView === 'info'} onClick={() => onNavigate('info')} view="info" title="Info">
                        <Icon name="info" className="w-4 h-4" />
                    </TitleBarNavButton>
                </nav>
                
                <div className="w-px h-5 bg-[--border-secondary]"/>
                
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center px-2">
                    <button
                        onClick={onToggleLogs}
                        className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover]"
                        aria-label="Toggle logs panel"
                        {...logsTooltip}
                    >
                        <Icon name="fileText" className="w-4 h-4" />
                    </button>
                    <ThemeSwitcher theme={theme} onToggle={onToggleTheme} />
                </div>
                
                {/* Window Controls */}
                <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex items-center h-full">
                    <button onClick={handleMinimize} className="px-4 h-full text-[--text-muted] hover:bg-[--bg-hover]">
                       <svg width="10" height="10" viewBox="0 0 10 1"><path d="M0,0.5 L10,0.5" stroke="currentColor" strokeWidth="1"/></svg>
                    </button>
                    <button onClick={handleMaximize} className="px-4 h-full text-[--text-muted] hover:bg-[--bg-hover]">
                        {isMaximized ? (
                             <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" fill="none" strokeWidth="1"><path d="m3.5,1.5 5,0 0,5" /><path d="M1.5,3.5 1.5,8.5 6.5,8.5" /></svg>
                        ) : (
                            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5,1.5 L8.5,1.5 L8.5,8.5 L1.5,8.5 Z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
                        )}
                    </button>
                    <button onClick={handleClose} className="px-4 h-full text-[--text-muted] hover:bg-red-600 hover:text-white">
                         <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5,1.5 L8.5,8.5 M8.5,1.5 L1.5,8.5" stroke="currentColor" strokeWidth="1.5"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TitleBar;
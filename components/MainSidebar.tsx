import React from 'react';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

interface MainSidebarProps {
    activeView: View;
    onNavigate: (view: View) => void;
    theme: 'light' | 'dark';
}

const NavItem: React.FC<{
    view: View;
    active: boolean;
    onClick: () => void;
    icon: string;
    label: string;
}> = ({ view, active, onClick, icon, label }) => {
    const tooltipProps = useTooltipTrigger(label);
    
    return (
        <button
            onClick={onClick}
            {...tooltipProps}
            aria-label={label}
            className={`group relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-chat] ${
                active 
                    ? 'bg-[--accent-chat]/15 text-[--accent-chat] border border-[--accent-chat]/30 shadow-sm' 
                    : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'
            }`}
        >
            <Icon name={icon as any} className="w-5 h-5" />
            
            {/* LM Studio Style Left Active Indicator Pill */}
            {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[--accent-chat] rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            )}
        </button>
    );
};

const MainSidebar: React.FC<MainSidebarProps> = ({ activeView, onNavigate, theme }) => {
    return (
        <aside className="flex flex-col items-center py-3 w-16 h-full bg-[--bg-sidebar]/95 backdrop-blur-xl border-r border-[--border-primary]/70 z-20 select-none">
            {/* LM Studio Style Top Emblem Logo */}
            <div className="mb-6 flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20">
                <Icon name="brainCircuit" className="w-5 h-5" />
            </div>

            <nav className="flex flex-col gap-3 flex-1 items-center">
                <NavItem 
                    view="chat" 
                    active={activeView === 'chat'} 
                    onClick={() => onNavigate('chat')} 
                    icon="messageSquare" 
                    label="AI Chat" 
                />
                <NavItem 
                    view="projects" 
                    active={activeView === 'projects'} 
                    onClick={() => onNavigate('projects')} 
                    icon="code" 
                    label="Projects" 
                />
                <NavItem 
                    view="api" 
                    active={activeView === 'api'} 
                    onClick={() => onNavigate('api')} 
                    icon="server" 
                    label="API Client" 
                />
                <NavItem 
                    view="info" 
                    active={activeView === 'info'} 
                    onClick={() => onNavigate('info')} 
                    icon="info" 
                    label="Resources & Docs" 
                />
            </nav>

            <div className="mt-auto flex flex-col items-center pb-1">
                <NavItem 
                    view="settings" 
                    active={activeView === 'settings'} 
                    onClick={() => onNavigate('settings')} 
                    icon="settings" 
                    label="Settings" 
                />
            </div>
        </aside>
    );
};

export default MainSidebar;

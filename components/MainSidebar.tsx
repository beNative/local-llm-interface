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
            className={`group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 ${
                active 
                    ? 'bg-[--accent-chat] text-white shadow-lg shadow-blue-500/20' 
                    : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'
            }`}
        >
            <Icon name={icon as any} className="w-6 h-6" />
            
            {/* Active Indicator (LM Studio style) */}
            {active && (
                <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
            )}
            
            {/* Hover Label (for accessibility/visual feedback if needed, though we have tooltips) */}
            <span className="sr-only">{label}</span>
        </button>
    );
};

const MainSidebar: React.FC<MainSidebarProps> = ({ activeView, onNavigate, theme }) => {
    return (
        <aside className="flex flex-col items-center py-4 w-16 h-full bg-[--bg-sidebar] border-r border-[--border-primary] z-20">
            {/* Logo area */}
            <div className="mb-8 p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-inner">
                <Icon name="brainCircuit" className="w-8 h-8 text-white" />
            </div>

            <nav className="flex flex-col gap-4 flex-1 items-center">
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

            <div className="mt-auto flex flex-col gap-4 items-center">
                <NavItem 
                    view="settings" 
                    active={activeView === 'settings'} 
                    onClick={() => onNavigate('settings')} 
                    icon="settings" 
                    label="Settings" 
                />
                
                {/* Visual separator or avatar could go here */}
                <div className="w-8 h-px bg-[--border-primary] my-2" />
                
                <div className="w-10 h-10 rounded-full bg-[--bg-tertiary] flex items-center justify-center text-[--text-muted] text-xs font-bold border border-[--border-primary]">
                    AI
                </div>
            </div>
        </aside>
    );
};

export default MainSidebar;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ChatSession, CodeProject } from '../types';
import { logger } from '../services/logger';
import Icon from './Icon';

type View = 'chat' | 'projects' | 'api' | 'settings' | 'info';

interface Command {
    type: 'view' | 'session' | 'project' | 'file';
    id: string;
    name: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    projects: CodeProject[];
    onNavigate: (view: View) => void;
    onSelectSession: (sessionId: string) => void;
    onOpenFile: (file: { path: string, name: string }) => void;
    anchorRect: DOMRect | null;
    onShowKeyboardShortcuts: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, sessions, projects, onNavigate, onSelectSession, onOpenFile, anchorRect, onShowKeyboardShortcuts }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [commands, setCommands] = useState<Command[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setSelectedIndex(0);
            
            // Base commands
            const baseCommands: Command[] = [
                { type: 'view', id: 'view_chat', name: 'Go to Chat', icon: <Icon name="messageSquare" className="w-4 h-4"/>, action: () => onNavigate('chat') },
                { type: 'view', id: 'view_projects', name: 'Go to Projects', icon: <Icon name="code" className="w-4 h-4"/>, action: () => onNavigate('projects') },
                { type: 'view', id: 'view_api', name: 'Go to API Client', icon: <Icon name="server" className="w-4 h-4"/>, action: () => onNavigate('api') },
                { type: 'view', id: 'view_settings', name: 'Go to Settings', icon: <Icon name="settings" className="w-4 h-4"/>, action: () => onNavigate('settings') },
                { type: 'view', id: 'view_settings_shortcuts', name: 'Open Keyboard Shortcuts', description: 'Customize keyboard shortcuts', icon: <Icon name="terminal" className="w-4 h-4"/>, action: () => onShowKeyboardShortcuts() },
                { type: 'view', id: 'view_info', name: 'Go to Info', icon: <Icon name="info" className="w-4 h-4"/>, action: () => onNavigate('info') },
            ];
            
            const sessionCommands: Command[] = sessions.map(s => ({
                type: 'session',
                id: s.id,
                name: `Chat: ${s.name}`,
                description: `Switch to session created on ${new Date(parseInt(s.id.split('_')[1])).toLocaleDateString()}`,
                icon: <Icon name="messageSquare" className="w-4 h-4" />,
                action: () => onSelectSession(s.id)
            }));
            
            setCommands([...baseCommands, ...sessionCommands]);

            // Asynchronously load files from all projects
            const fetchAllFiles = async () => {
                if (!window.electronAPI) return;
                setIsLoadingFiles(true);
                try {
                    const filePromises = projects.map(p => 
                        window.electronAPI!.projectGetAllFiles(p.path).then(files => ({ project: p, files }))
                    );
                    const results = await Promise.all(filePromises);
                    const fileCommands: Command[] = results.flatMap(({ project, files }) =>
                        files.map(file => ({
                            type: 'file',
                            id: file.path,
                            name: file.name,
                            description: `In project: ${project.name}`,
                            icon: <Icon name="file" className="w-4 h-4" />,
                            action: () => onOpenFile(file)
                        }))
                    );
                    setCommands(current => [...current, ...fileCommands]);
                } catch(e) {
                    logger.error(`Failed to load project files for command palette: ${e}`);
                } finally {
                    setIsLoadingFiles(false);
                }
            };
            fetchAllFiles();

        } else {
            setSearchTerm('');
        }
    }, [isOpen, sessions, projects, onNavigate, onSelectSession, onOpenFile, onShowKeyboardShortcuts]);

    const filteredCommands = useMemo(() => {
        if (!searchTerm) return commands;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return commands.filter(c =>
            c.name.toLowerCase().includes(lowerCaseSearch) ||
            (c.description && c.description.toLowerCase().includes(lowerCaseSearch))
        );
    }, [searchTerm, commands]);

    const executeCommand = (command: Command) => {
        command.action();
        onClose();
    };
    
    useEffect(() => {
        if (selectedIndex >= 0 && resultsRef.current) {
            const element = resultsRef.current.children[selectedIndex] as HTMLElement;
            element?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const command = filteredCommands[selectedIndex];
            if (command) {
                executeCommand(command);
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };
    
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchTerm]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const paletteStyle = useMemo(() => {
        if (!anchorRect) return { display: 'none' };
        return {
            position: 'absolute' as const,
            top: `${anchorRect.bottom + 8}px`, // 8px offset
            left: `${anchorRect.left}px`,
            width: `${anchorRect.width}px`,
        };
    }, [anchorRect]);


    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex justify-center pt-16 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" 
            onClick={handleBackdropClick}
        >
            <div 
                className="w-full max-w-2xl bg-[--bg-secondary] border border-[--border-primary] shadow-2xl overflow-hidden flex flex-col h-fit animate-in zoom-in-95 duration-200" 
                onClick={e => e.stopPropagation()}
            >
                {/* Search Header */}
                <div className="flex items-center gap-3 p-4 bg-[--bg-sidebar] border-b border-[--border-primary]">
                    <Icon name="search" className="w-5 h-5 text-[--accent-chat]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search for chats, projects, files, and commands..."
                        className="w-full bg-transparent text-base font-medium text-[--text-primary] focus:outline-none placeholder:text-[--text-muted]/60"
                    />
                    {isLoadingFiles && <Icon name="spinner" className="w-4 h-4 text-[--text-muted] animate-spin" />}
                </div>

                {/* Results List */}
                <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar bg-[--bg-secondary]">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((command, index) => (
                            <div
                                key={command.id}
                                onClick={() => executeCommand(command)}
                                onMouseMove={() => setSelectedIndex(index)}
                                className={`flex items-center justify-between gap-4 px-4 py-3 cursor-pointer transition-all border-l-2 ${selectedIndex === index ? 'bg-[--bg-hover] border-[--accent-chat]' : 'border-transparent'}`}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`p-2 rounded-lg ${selectedIndex === index ? 'text-[--accent-chat]' : 'text-[--text-muted]'}`}>
                                        {command.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-sm font-semibold truncate ${selectedIndex === index ? 'text-[--text-primary]' : 'text-[--text-secondary]'}`}>
                                            {command.name}
                                        </p>
                                        {command.description && (
                                            <p className="text-[11px] text-[--text-muted] truncate uppercase tracking-wider font-bold opacity-60">
                                                {command.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-[--border-primary] text-[--text-muted] bg-[--bg-sidebar]">
                                        {command.type}
                                    </span>
                                    {selectedIndex === index && (
                                        <div className="text-[--accent-chat]">
                                            <Icon name="chevronRight" className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <Icon name="search" className="w-12 h-12 text-[--border-primary] mb-4 opacity-20" />
                            <p className="text-sm text-[--text-muted]">No results found for <span className="text-[--text-secondary] font-bold">"{searchTerm}"</span></p>
                        </div>
                    )}
                </div>

                {/* Footer / Hints */}
                <div className="px-4 py-2 bg-[--bg-sidebar] border-t border-[--border-primary] flex items-center justify-between">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[--bg-tertiary] border border-[--border-primary] rounded text-[--text-muted]">↑↓</kbd>
                            <span className="text-[10px] text-[--text-muted] uppercase font-bold tracking-wider">Navigate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[--bg-tertiary] border border-[--border-primary] rounded text-[--text-muted]">Enter</kbd>
                            <span className="text-[10px] text-[--text-muted] uppercase font-bold tracking-wider">Select</span>
                        </div>
                         <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[--bg-tertiary] border border-[--border-primary] rounded text-[--text-muted]">Esc</kbd>
                            <span className="text-[10px] text-[--text-muted] uppercase font-bold tracking-wider">Close</span>
                        </div>
                    </div>
                    <div className="text-[10px] text-[--text-muted] uppercase font-bold tracking-widest opacity-40">
                        Quick Command Palette
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
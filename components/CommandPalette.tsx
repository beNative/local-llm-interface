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
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, sessions, projects, onNavigate, onSelectSession, onOpenFile, anchorRect }) => {
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
    }, [isOpen, sessions, projects, onNavigate, onSelectSession, onOpenFile]);

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
        <div className="fixed inset-0 z-50 bg-transparent" onClick={handleBackdropClick}>
            <div 
                style={paletteStyle}
                className="bg-[--bg-secondary] rounded-[--border-radius] shadow-2xl border border-[--border-primary]" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 p-4 border-b border-[--border-primary]">
                    <Icon name="search" className="w-5 h-5 text-[--text-muted]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search for chats, projects, files, and commands..."
                        className="w-full bg-transparent text-[--text-primary] focus:outline-none placeholder:text-[--text-muted]"
                    />
                     {isLoadingFiles && <Icon name="spinner" className="w-5 h-5 text-[--text-muted]" />}
                </div>
                <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto p-2">
                    {filteredCommands.length > 0 ? (
                        filteredCommands.map((command, index) => (
                            <div
                                key={command.id}
                                onClick={() => executeCommand(command)}
                                onMouseMove={() => setSelectedIndex(index)}
                                className={`flex items-center justify-between gap-4 p-3 rounded-lg cursor-pointer ${selectedIndex === index ? 'bg-[--bg-hover]' : ''}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="text-[--text-muted]">{command.icon}</div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-[--text-primary] truncate">{command.name}</p>
                                        {command.description && <p className="text-xs text-[--text-muted] truncate">{command.description}</p>}
                                    </div>
                                </div>
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[--bg-tertiary] text-[--text-muted] flex-shrink-0">{command.type}</span>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-6 text-sm text-[--text-muted]">No results found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
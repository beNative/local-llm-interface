
import React, { useState } from 'react';
import type { Config, CodeProject, ProjectType, FileSystemEntry } from '../types';
import CodeIcon from './icons/CodeIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';
import TrashIcon from './icons/TrashIcon';
import GlobeIcon from './icons/GlobeIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import MessagePlusIcon from './icons/MessagePlusIcon';
import FileTree from './FileTree';
import { logger } from '../services/logger';

interface EditorModalProps {
  file: { path: string, name: string };
  onClose: () => void;
  onAddToChat: (filename: string, content: string) => void;
}

const EditorModal: React.FC<EditorModalProps> = ({ file, onClose, onAddToChat }) => {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string|null>(null);

    React.useEffect(() => {
        const loadFile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fileContent = await window.electronAPI!.readProjectFile(file.path);
                setContent(fileContent);
            } catch (e) {
                const msg = `Failed to read file: ${e instanceof Error ? e.message : String(e)}`;
                logger.error(msg);
                setError(msg);
            } finally {
                setIsLoading(false);
            }
        };
        loadFile();
    }, [file.path]);
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await window.electronAPI!.writeProjectFile(file.path, content);
            logger.info(`Saved changes to ${file.path}`);
            onClose();
        } catch (e) {
             const msg = `Failed to save file: ${e instanceof Error ? e.message : String(e)}`;
            logger.error(msg);
            alert(msg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono">{file.name}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono hidden sm:block">{file.path}</p>
                </header>
                <main className="flex-1 overflow-hidden p-2">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center"><SpinnerIcon className="w-8 h-8" /></div>
                    ) : error ? (
                        <div className="h-full flex items-center justify-center text-red-500">{error}</div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full p-2 font-mono text-sm bg-gray-100 dark:bg-gray-900 rounded-md resize-none focus:outline-none"
                            spellCheck="false"
                        />
                    )}
                </main>
                 <footer className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                    <button 
                        onClick={() => onAddToChat(file.name, content)} 
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400">
                        <MessagePlusIcon className="w-5 h-5"/>
                        Add to Chat Context
                    </button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800">
                        {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Save Changes'}
                    </button>
                </footer>
            </div>
        </div>
    );
};


const ProjectCard: React.FC<{
    project: CodeProject;
    onDelete: () => void;
    onInstall: () => void;
    onOpen: () => void;
    onOpenWebApp: () => void;
    isBusy: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onFileClick: (file: FileSystemEntry) => void;
}> = ({ project, onDelete, onInstall, onOpen, onOpenWebApp, isBusy, isExpanded, onToggleExpand, onFileClick }) => {
    
    const typeColor = project.type === 'python' ? 'text-blue-500' 
                    : project.type === 'nodejs' ? 'text-green-500'
                    : 'text-purple-500';
    
    return (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4">
                <div 
                    className="flex items-center gap-3 mb-2 cursor-pointer"
                    onClick={onToggleExpand}
                >
                    <CodeIcon className={`w-6 h-6 ${typeColor}`} />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{project.name}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {project.type}
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">{project.path}</p>
            
                <div className="flex items-center gap-2 mt-4">
                    {project.type === 'webapp' ? (
                         <button onClick={onOpenWebApp} disabled={isBusy} className="flex-1 text-sm px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-wait flex items-center justify-center gap-2">
                            <GlobeIcon className="w-4 h-4" />
                            {isBusy ? 'Working...' : 'Open in Browser'}
                        </button>
                    ) : (
                         <button onClick={onInstall} disabled={isBusy} className="flex-1 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait">
                            {isBusy ? 'Working...' : 'Install Deps'}
                        </button>
                    )}
                   
                    <button onClick={onOpen} disabled={isBusy} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50" title="Open folder">
                        <FolderOpenIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={onDelete} disabled={isBusy} className="p-2 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50" title="Delete project">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto">
                   <FileTree projectPath={project.path} onFileClick={onFileClick} />
                </div>
            )}
        </div>
    );
};

const NewProjectForm: React.FC<{
    basePath: string | undefined;
    projectType: ProjectType;
    onCreate: (name: string) => void;
    isBusy: boolean;
}> = ({ basePath, projectType, onCreate, isBusy }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(name.trim()) {
            onCreate(name.trim());
            setName('');
        }
    }
    
    if (!basePath) return null;

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="New project name..."
                className="flex-grow px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isBusy}
            />
            <button type="submit" disabled={!name.trim() || isBusy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed">
                {isBusy ? <SpinnerIcon className="w-5 h-5"/> : 'Create'}
            </button>
        </form>
    );
};

interface ProjectsViewProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isElectron: boolean;
  onInjectContentForChat: (filename: string, content: string) => void;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ config, onConfigChange, isElectron, onInjectContentForChat }) => {
    const [busyProjects, setBusyProjects] = useState<Set<string>>(new Set());
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [editingFile, setEditingFile] = useState<{ path: string, name: string } | null>(null);
    
    if (!isElectron) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <h2 className="text-xl font-bold">Feature Not Available</h2>
                <p>Project management is only available in the desktop application.</p>
            </div>
        );
    }
    
    const setProjectBusy = (projectId: string, isBusy: boolean) => {
        setBusyProjects(prev => {
            const next = new Set(prev);
            if (isBusy) next.add(projectId);
            else next.delete(projectId);
            return next;
        });
    };

    const handleSetPath = async (type: ProjectType) => {
        const path = await window.electronAPI?.selectDirectory();
        if (path) {
            const key = type === 'python' ? 'pythonProjectsPath' 
                      : type === 'nodejs' ? 'nodejsProjectsPath'
                      : 'webAppsPath';
            onConfigChange({...config, [key]: path});
        }
    };

    const handleCreateProject = async (projectType: ProjectType, name: string) => {
        const basePath = projectType === 'python' ? config.pythonProjectsPath 
                       : projectType === 'nodejs' ? config.nodejsProjectsPath
                       : config.webAppsPath;
        if (!basePath) return;

        setProjectBusy('new_project', true);
        try {
            const newProject = await window.electronAPI!.createProject({ projectType, name, basePath });
            onConfigChange({ ...config, projects: [...(config.projects || []), newProject] });
            logger.info(`Created new ${projectType} project: ${name}`);
        } catch (e) {
            logger.error(e instanceof Error ? e : String(e));
            alert(`Error creating project: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setProjectBusy('new_project', false);
        }
    };
    
    const handleDeleteProject = async (project: CodeProject) => {
        if (!confirm(`Are you sure you want to permanently delete the project "${project.name}" and all its files?`)) return;
        setProjectBusy(project.id, true);
        try {
            await window.electronAPI!.deleteProject(project.path);
            onConfigChange({ ...config, projects: config.projects?.filter(p => p.id !== project.id) || [] });
            logger.info(`Deleted project: ${project.name}`);
        } catch (e) {
            logger.error(`Failed to delete project: ${e}`);
            alert(`Error deleting project: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setProjectBusy(project.id, false);
        }
    };

    const handleInstallDeps = async (project: CodeProject) => {
        setProjectBusy(project.id, true);
        logger.info(`Installing dependencies for project: ${project.name}`);
        try {
            const { stdout, stderr } = await window.electronAPI!.installProjectDeps(project);
            if (stderr) {
                logger.error(`Dependency installation for ${project.name} failed:\n${stderr}`);
                alert(`Error installing dependencies for ${project.name}:\n${stderr}`);
            } else {
                logger.info(`Dependency installation for ${project.name} successful:\n${stdout}`);
                alert(`Successfully installed dependencies for ${project.name}.`);
            }
        } catch(e) {
            logger.error(`Failed to install dependencies: ${e}`);
        } finally {
            setProjectBusy(project.id, false);
        }
    };

    const handleOpenFolder = (project: CodeProject) => {
        window.electronAPI?.openProjectFolder(project.path);
    };

    const handleOpenWebApp = (project: CodeProject) => {
        window.electronAPI?.openWebApp(project.path);
    };

    const handleToggleExpand = (projectId: string) => {
        setExpandedProjectId(current => current === projectId ? null : projectId);
    };

    const handleFileClick = (file: FileSystemEntry) => {
        setEditingFile({ path: file.path, name: file.name });
    };
    
    const renderProjectSection = (type: ProjectType) => {
        const title = type === 'python' ? 'Python Projects' 
                    : type === 'nodejs' ? 'Node.js Projects' 
                    : 'Web App Projects';
        const path = type === 'python' ? config.pythonProjectsPath 
                   : type === 'nodejs' ? config.nodejsProjectsPath 
                   : config.webAppsPath;
        const projects = config.projects?.filter(p => p.type === type) || [];
        
        return (
             <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-gray-200 dark:border-gray-700 pb-3">{title}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Projects Base Directory
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={path || 'Not set'}
                                className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md"
                            />
                            <button onClick={() => handleSetPath(type)} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700">
                                Choose...
                            </button>
                        </div>
                    </div>
                    {path && <NewProjectForm basePath={path} projectType={type} onCreate={(name) => handleCreateProject(type, name)} isBusy={busyProjects.has('new_project')} />}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {projects.map(p => (
                            <ProjectCard 
                                key={p.id}
                                project={p}
                                isBusy={busyProjects.has(p.id)}
                                onDelete={() => handleDeleteProject(p)}
                                onInstall={() => handleInstallDeps(p)}
                                onOpen={() => handleOpenFolder(p)}
                                onOpenWebApp={() => handleOpenWebApp(p)}
                                isExpanded={expandedProjectId === p.id}
                                onToggleExpand={() => handleToggleExpand(p.id)}
                                onFileClick={handleFileClick}
                            />
                       ))}
                    </div>
                    {path && projects.length === 0 && <p className="text-sm text-center py-4 text-gray-500 dark:text-gray-400">No {type} projects yet. Create one above.</p>}
                </div>
            </div>
        );
    }

  return (
    <>
    {editingFile && <EditorModal file={editingFile} onClose={() => setEditingFile(null)} onAddToChat={onInjectContentForChat} />}
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white mb-8">
          <CodeIcon className="w-8 h-8"/>
          Projects
        </h1>
        
        <div className="space-y-8 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            {renderProjectSection('python')}
        </div>
        
        <div className="mt-8 space-y-8 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            {renderProjectSection('nodejs')}
        </div>

        <div className="mt-8 space-y-8 bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            {renderProjectSection('webapp')}
        </div>
      </div>
    </div>
    </>
  );
};

export default ProjectsView;
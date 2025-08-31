import React, { useState } from 'react';
import type { Config, CodeProject, ProjectType, FileSystemEntry } from '../types';
import FileTree from './FileTree';
import { logger } from '../services/logger';
import Icon from './Icon';

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

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-[--border-primary] flex-shrink-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[--text-primary] font-mono">{file.name}</h2>
                    <p className="text-xs text-[--text-muted] font-mono hidden sm:block">{file.path}</p>
                </header>
                <main className="flex-1 overflow-hidden p-2">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center"><Icon name="spinner" className="w-8 h-8" /></div>
                    ) : error ? (
                        <div className="h-full flex items-center justify-center text-red-500">{error}</div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full p-2 font-mono text-sm bg-[--bg-primary] text-[--text-primary] rounded-md resize-none focus:outline-none"
                            spellCheck="false"
                        />
                    )}
                </main>
                 <footer className="flex justify-end gap-3 p-4 border-t border-[--border-primary] flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover]">Cancel</button>
                    <button 
                        onClick={() => onAddToChat(file.name, content)} 
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400">
                        <Icon name="messagePlus" className="w-5 h-5"/>
                        Add to Chat Context
                    </button>
                    <button onClick={handleSave} disabled={isSaving || isLoading} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--accent-chat] rounded-lg hover:brightness-90 disabled:opacity-60">
                        {isSaving ? <Icon name="spinner" className="w-5 h-5"/> : 'Save Changes'}
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
    onRun: () => void;
    onOpen: () => void;
    isBusy: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onFileClick: (file: FileSystemEntry) => void;
}> = ({ project, onDelete, onInstall, onRun, onOpen, isBusy, isExpanded, onToggleExpand, onFileClick }) => {
    
    const typeColor = project.type === 'python' ? 'text-blue-500' 
                    : project.type === 'nodejs' ? 'text-green-500'
                    : project.type === 'java' ? 'text-red-500'
                    : project.type === 'delphi' ? 'text-orange-500'
                    : 'text-purple-500';

    const runIsGlobe = project.type === 'webapp';
    const runText = project.type === 'webapp' ? 'Run in Browser' 
                  : project.type === 'delphi' ? 'Build Project' 
                  : 'Run Project';
    
    const runTitle = project.type === 'webapp' 
        ? 'Open this web app in your default browser' 
        : project.type === 'delphi' 
            ? `Build ${project.name}.dpr and create an executable`
            : `Run the main entry point for this project (e.g., main.py, app.js)`;

    const installTitle = project.type === 'python' 
        ? "Install dependencies from requirements.txt into the project's venv" 
        : project.type === 'nodejs' 
            ? 'Install dependencies from package.json using npm' 
            : 'Download dependencies using Maven';

    return (
        <div className="bg-[--bg-primary] rounded-[--border-radius] border border-[--border-primary] flex flex-col transition-shadow hover:shadow-md">
            <div className="p-4">
                <div 
                    className="flex items-start gap-3 mb-2 cursor-pointer"
                    onClick={onToggleExpand}
                >
                    <Icon name="code" className={`w-6 h-6 ${typeColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-grow min-w-0">
                      <h4 className="text-lg font-semibold text-[--text-primary] truncate">{project.name}</h4>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[--bg-tertiary] text-[--text-secondary]">
                        {project.type}
                      </span>
                    </div>
                </div>
                <p className="text-xs text-[--text-muted] font-mono break-all mt-2">{project.path}</p>
            
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={onRun} disabled={isBusy} className="col-span-2 text-sm px-3 py-2 rounded-lg bg-[--accent-projects] text-white hover:brightness-95 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 font-semibold" title={runTitle}>
                        {isBusy ? <Icon name="spinner" className="w-5 h-5"/> : <Icon name={runIsGlobe ? 'globe' : 'play'} className="w-5 h-5" />}
                        {isBusy ? 'Working...' : runText}
                    </button>

                    {project.type !== 'webapp' && project.type !== 'delphi' && (
                         <button onClick={onInstall} disabled={isBusy} className="text-xs px-3 py-1.5 rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover] disabled:opacity-50" title={installTitle}>
                            Install Deps
                        </button>
                    )}
                   
                    <button onClick={onOpen} disabled={isBusy} className="text-xs px-3 py-1.5 rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover] disabled:opacity-50 flex items-center justify-center gap-1.5" title="Open project folder in your file explorer">
                        <Icon name="folderOpen" className="w-4 h-4"/>
                        <span>Folder</span>
                    </button>

                    <button onClick={onDelete} disabled={isBusy} className={`col-span-2 ${project.type !== 'webapp' && project.type !== 'delphi' ? '' : 'col-start-2'} mt-1 text-xs px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50 flex items-center justify-center gap-1.5`} title="Permanently delete this project and all its files. This action cannot be undone.">
                        <Icon name="trash" className="w-4 h-4" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="border-t border-[--border-primary] max-h-80 overflow-y-auto bg-black/5 dark:bg-black/20">
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
                className="flex-grow px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                disabled={isBusy}
            />
            <button type="submit" disabled={!name.trim() || isBusy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed" title={`Create a new ${projectType} project folder with appropriate boilerplate files`}>
                {isBusy ? <Icon name="spinner" className="w-5 h-5"/> : 'Create'}
            </button>
        </form>
    );
};

interface ProjectsViewProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isElectron: boolean;
  onInjectContentForChat: (filename: string, content: string) => void;
  onRunProject: (project: CodeProject) => void;
  editingFile: { path: string, name: string } | null;
  onSetEditingFile: (file: { path: string, name: string } | null) => void;
}

const projectTypes: { key: ProjectType; name: string }[] = [
    { key: 'python', name: 'Python' },
    { key: 'nodejs', name: 'Node.js' },
    { key: 'java', name: 'Java' },
    { key: 'delphi', name: 'Delphi' },
    { key: 'webapp', name: 'Web App' },
];

const ProjectsView: React.FC<ProjectsViewProps> = ({ config, onConfigChange, isElectron, onInjectContentForChat, onRunProject, editingFile, onSetEditingFile }) => {
    const [busyProjects, setBusyProjects] = useState<Set<string>>(new Set());
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ProjectType>('python');
    
    if (!isElectron) {
        return (
            <div className="p-8 text-center text-[--text-muted]">
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
                      : type === 'java' ? 'javaProjectsPath'
                      : type === 'delphi' ? 'delphiProjectsPath'
                      : 'webAppsPath';
            onConfigChange({...config, [key]: path});
        }
    };

    const handleCreateProject = async (projectType: ProjectType, name: string) => {
        const basePath = projectType === 'python' ? config.pythonProjectsPath 
                       : projectType === 'nodejs' ? config.nodejsProjectsPath
                       : projectType === 'java' ? config.javaProjectsPath
                       : projectType === 'delphi' ? config.delphiProjectsPath
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
    
    const handleRunProjectWithBusyState = async (project: CodeProject) => {
        setProjectBusy(project.id, true);
        await onRunProject(project);
        setProjectBusy(project.id, false);
    };

    const handleOpenFolder = (project: CodeProject) => {
        window.electronAPI?.openProjectFolder(project.path);
    };

    const handleToggleExpand = (projectId: string) => {
        setExpandedProjectId(current => current === projectId ? null : projectId);
    };

    const handleFileClick = (file: FileSystemEntry) => {
        onSetEditingFile({ path: file.path, name: file.name });
    };
    
    const renderProjectSection = (type: ProjectType) => {
        const title = type === 'python' ? 'Python Projects' 
                    : type === 'nodejs' ? 'Node.js Projects' 
                    : type === 'java' ? 'Java Projects'
                    : type === 'delphi' ? 'Delphi Projects'
                    : 'Web App Projects';
        const path = type === 'python' ? config.pythonProjectsPath 
                   : type === 'nodejs' ? config.nodejsProjectsPath 
                   : type === 'java' ? config.javaProjectsPath
                   : type === 'delphi' ? config.delphiProjectsPath
                   : config.webAppsPath;
        const projects = config.projects?.filter(p => p.type === type) || [];
        
        return (
             <div className="bg-[--bg-primary] p-6 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                <h3 className="text-lg font-semibold text-[--text-secondary] mb-4 border-b border-[--border-primary] pb-3">{title}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[--text-muted] mb-1">
                        Projects Base Directory
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={path || 'Not set'}
                                className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg"
                            />
                            <button onClick={() => handleSetPath(type)} className="px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--accent-chat] hover:brightness-95 rounded-lg" title={`Select the base folder where your ${type} projects are, or will be, stored`}>
                                Choose...
                            </button>
                        </div>
                    </div>
                    {path && <NewProjectForm basePath={path} projectType={type} onCreate={(name) => handleCreateProject(type, name)} isBusy={busyProjects.has('new_project')} />}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                       {projects.map(p => (
                            <ProjectCard 
                                key={p.id}
                                project={p}
                                isBusy={busyProjects.has(p.id)}
                                onDelete={() => handleDeleteProject(p)}
                                onInstall={() => handleInstallDeps(p)}
                                onRun={() => handleRunProjectWithBusyState(p)}
                                onOpen={() => handleOpenFolder(p)}
                                isExpanded={expandedProjectId === p.id}
                                onToggleExpand={() => handleToggleExpand(p.id)}
                                onFileClick={handleFileClick}
                            />
                       ))}
                    </div>
                    {path && projects.length === 0 && <p className="text-sm text-center py-4 text-[--text-muted]">No {type} projects yet. Create one above.</p>}
                </div>
            </div>
        );
    }

  return (
    <>
    {editingFile && <EditorModal file={editingFile} onClose={() => onSetEditingFile(null)} onAddToChat={onInjectContentForChat} />}
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-secondary]">
      <div className="max-w-4xl mx-auto">
        <h1 className="flex items-center gap-3 text-3xl font-bold mb-8" style={{color: 'var(--accent-projects)'}}>
          <Icon name="code" className="w-8 h-8"/>
          Projects
        </h1>
        
        <div className="mb-8 border-b border-[--border-primary]">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                {projectTypes.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === tab.key
                                ? 'border-[--accent-projects] text-[--accent-projects]'
                                : 'border-transparent text-[--text-muted] hover:text-[--text-primary] hover:border-gray-300 dark:hover:border-gray-700'
                        }`}
                    >
                        {tab.name}
                    </button>
                ))}
            </nav>
        </div>

        <div>
            {renderProjectSection(activeTab)}
        </div>
      </div>
    </div>
    </>
  );
};

export default ProjectsView;
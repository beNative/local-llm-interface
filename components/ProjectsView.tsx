import React, { useState } from 'react';
import type { Config, CodeProject, ProjectType, FileSystemEntry } from '../types';
import FileTree from './FileTree';
import { logger } from '../services/logger';
import Icon from './Icon';
import ModalContainer from './Modal';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

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
        <ModalContainer
            onClose={onClose}
            title={
                <div className="flex flex-col gap-[var(--space-1)] font-mono">
                    <span className="text-[length:var(--font-size-lg)] font-semibold text-[--text-primary]">{file.name}</span>
                    <span className="text-xs font-normal text-[--text-muted] hidden sm:block break-all">{file.path}</span>
                </div>
            }
            size="xl"
            panelClassName="h-[80vh]"
            bodyClassName="flex flex-1 flex-col gap-[var(--space-3)]"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="rounded-[--border-radius] bg-[--bg-tertiary] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-[--text-secondary] hover:bg-[--bg-hover]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onAddToChat(file.name, content)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-[var(--space-2)] rounded-[--border-radius] bg-green-600 px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
                    >
                        <Icon name="messagePlus" className="h-5 w-5" />
                        Add to Chat Context
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                        className="flex items-center justify-center gap-[var(--space-2)] rounded-[--border-radius] bg-[--accent-chat] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-sm)] font-medium text-[--text-on-accent] hover:brightness-95 disabled:opacity-60"
                    >
                        {isSaving ? <Icon name="spinner" className="h-5 w-5" /> : 'Save Changes'}
                    </button>
                </>
            }
        >
            <div className="flex h-full min-h-0 flex-1 flex-col">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Icon name="spinner" className="h-8 w-8" />
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center text-red-500">{error}</div>
                ) : (
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="h-full w-full flex-1 resize-none rounded-[--border-radius] bg-[--bg-primary] p-[var(--space-2)] font-mono text-sm text-[--text-primary] focus:outline-none"
                        spellCheck="false"
                    />
                )}
            </div>
        </ModalContainer>
    );
};


const ProjectCard: React.FC<{
    project: CodeProject;
    onDelete: () => void;
    onInstall: () => void;
    onRun: () => void;
    onOpen: () => void;
    onChat: () => void;
    isBusy: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onFileClick: (file: FileSystemEntry) => void;
}> = ({ project, onDelete, onInstall, onRun, onOpen, onChat, isBusy, isExpanded, onToggleExpand, onFileClick }) => {
    
    const typeColor = project.type === 'python' ? 'text-blue-500' 
                    : project.type === 'nodejs' ? 'text-green-500'
                    : project.type === 'java' ? 'text-red-500'
                    : project.type === 'delphi' ? 'text-orange-500'
                    : 'text-purple-500';

    const runIsGlobe = project.type === 'webapp';
    const runText = project.type === 'webapp' ? 'Open' 
                  : project.type === 'delphi' ? 'Build' 
                  : 'Run';
    
    const chatTooltip = useTooltipTrigger("Start a new chat with this project as context. The AI will be able to read files and run commands.");
    const runTooltip = useTooltipTrigger(project.type === 'webapp' 
        ? 'Open this web app in your default browser' 
        : project.type === 'delphi' 
            ? `Build ${project.name}.dpr and create an executable`
            : `Run the main entry point for this project (e.g., main.py, app.js)`);

    const installTooltip = useTooltipTrigger(project.type === 'python' 
        ? "Install dependencies from requirements.txt into the project's venv" 
        : project.type === 'nodejs' 
            ? 'Install dependencies from package.json using npm' 
            : 'Download dependencies using Maven');
    
    const openFolderTooltip = useTooltipTrigger("Open project folder in your file explorer");
    const deleteTooltip = useTooltipTrigger("Permanently delete this project and all its files. This action cannot be undone.");
    const expandTooltip = useTooltipTrigger(isExpanded ? "Collapse file explorer" : "Expand file explorer");
    const pathTooltip = useTooltipTrigger(project.path);

    return (
        <div className={`bg-[--bg-primary] rounded-[--border-radius] border border-[--border-primary] flex flex-col transition-all duration-200 ${isExpanded ? 'shadow-xl ring-2 ring-[--accent-projects]/50' : 'hover:shadow-md'}`}>
            <div className="p-4">
                <div className="flex items-center gap-3 mb-2">
                    <Icon name="code" className={`w-6 h-6 ${typeColor} flex-shrink-0`} />
                    <div className="flex-grow min-w-0">
                      <h4 className="text-lg font-semibold text-[--text-primary] truncate">{project.name}</h4>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[--bg-tertiary] text-[--text-secondary]">
                        {project.type}
                      </span>
                    </div>
                </div>
                
                <p
                    className="text-xs text-[--text-muted] font-mono break-all h-8 overflow-hidden"
                    {...pathTooltip}
                >
                    {project.path}
                </p>
            
                <div className="grid grid-cols-2 gap-2 mt-4">
                     <button {...chatTooltip} onClick={onChat} disabled={isBusy} className="col-span-2 text-sm px-4 py-2 rounded-lg bg-[--accent-projects] text-white hover:brightness-95 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2 font-semibold">
                        {isBusy ? <Icon name="spinner" className="w-5 h-5"/> : <Icon name="messageSquare" className="w-5 h-5" />}
                        {isBusy ? 'Working...' : 'Chat about Project'}
                    </button>

                    <div className="col-span-2 flex items-center gap-1">
                        <button {...runTooltip} onClick={onRun} disabled={isBusy} className="flex-grow text-sm px-3 py-1.5 rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover] disabled:opacity-50 flex items-center justify-center gap-2">
                            <Icon name={runIsGlobe ? 'globe' : 'play'} className="w-4 h-4" />
                            {runText}
                        </button>
                        {project.type !== 'webapp' && project.type !== 'delphi' && (
                             <button {...installTooltip} onClick={onInstall} disabled={isBusy} className="p-2 rounded-lg text-[--text-muted] hover:bg-[--bg-hover] disabled:opacity-50">
                                <Icon name="downloadCloud" className="w-5 h-5" />
                            </button>
                        )}
                        <button {...openFolderTooltip} onClick={onOpen} disabled={isBusy} className="p-2 rounded-lg text-[--text-muted] hover:bg-[--bg-hover] disabled:opacity-50">
                            <Icon name="folderOpen" className="w-5 h-5"/>
                        </button>
                        <button {...deleteTooltip} onClick={onDelete} disabled={isBusy} className="p-2 rounded-lg text-[--text-muted] hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50">
                            <Icon name="trash" className="w-5 h-5" />
                        </button>
                        <div className="w-px h-5 bg-[--border-secondary] mx-1" />
                        <button {...expandTooltip} onClick={onToggleExpand} className="p-2 rounded-lg text-[--text-muted] hover:bg-[--bg-hover]">
                            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-5 h-5"/>
                        </button>
                    </div>
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
    const createTooltip = useTooltipTrigger(`Create a new ${projectType} project folder with appropriate boilerplate files`);

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
            <button {...createTooltip} type="submit" disabled={!name.trim() || isBusy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed">
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
  onNewChatWithProject: (projectId: string) => void;
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

const ProjectsView: React.FC<ProjectsViewProps> = ({ config, onConfigChange, isElectron, onInjectContentForChat, onRunProject, onNewChatWithProject, editingFile, onSetEditingFile }) => {
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
        const chooseTooltip = useTooltipTrigger(`Select the base folder where your ${type} projects are, or will be, stored`);
        
        return (
             <div className="space-y-6">
                <div className="bg-[--bg-primary] p-4 rounded-[--border-radius] border border-[--border-primary] shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-[--text-secondary]">{title}</h3>
                            <p className="text-sm text-[--text-muted] mt-1">
                                Base Directory: <span className="font-mono bg-[--bg-tertiary] px-2 py-1 rounded">{path || 'Not set'}</span>
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button {...chooseTooltip} onClick={() => handleSetPath(type)} className="px-4 py-2 text-sm font-medium text-[--text-on-accent] bg-[--accent-chat] hover:brightness-95 rounded-lg">
                                Choose...
                            </button>
                        </div>
                    </div>
                    {path && (
                        <div className="mt-4 pt-4 border-t border-[--border-primary]">
                            <NewProjectForm basePath={path} projectType={type} onCreate={(name) => handleCreateProject(type, name)} isBusy={busyProjects.has('new_project')} />
                        </div>
                    )}
                </div>

                {path ? (
                    projects.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                           {projects.map(p => (
                                <ProjectCard 
                                    key={p.id}
                                    project={p}
                                    isBusy={busyProjects.has(p.id)}
                                    onDelete={() => handleDeleteProject(p)}
                                    onInstall={() => handleInstallDeps(p)}
                                    onRun={() => handleRunProjectWithBusyState(p)}
                                    onOpen={() => handleOpenFolder(p)}
                                    onChat={() => onNewChatWithProject(p.id)}
                                    isExpanded={expandedProjectId === p.id}
                                    onToggleExpand={() => handleToggleExpand(p.id)}
                                    onFileClick={handleFileClick}
                                />
                           ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[--text-muted]">
                            <Icon name="folder" className="w-12 h-12 mx-auto mb-4"/>
                            <p className="text-lg">No {type} projects yet.</p>
                            <p>Use the form above to create your first one.</p>
                        </div>
                    )
                ) : (
                     <div className="text-center py-12 text-[--text-muted]">
                        <Icon name="folderOpen" className="w-12 h-12 mx-auto mb-4"/>
                        <h4 className="text-lg font-semibold text-[--text-secondary]">Set a Base Directory</h4>
                        <p>Choose a folder on your computer to store your {type} projects.</p>
                    </div>
                )}
            </div>
        );
    }

  return (
    <>
    {editingFile && <EditorModal file={editingFile} onClose={() => onSetEditingFile(null)} onAddToChat={onInjectContentForChat} />}
    <div className="p-4 sm:p-6 h-full overflow-y-auto bg-[--bg-secondary]">
      <div>
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
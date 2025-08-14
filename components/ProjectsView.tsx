import React, { useState } from 'react';
import type { Config, CodeProject, ProjectType } from '../types';
import CodeIcon from './icons/CodeIcon';
import FolderOpenIcon from './icons/FolderOpenIcon';
import TrashIcon from './icons/TrashIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { logger } from '../services/logger';

interface ProjectsViewProps {
  config: Config;
  onConfigChange: (newConfig: Config) => void;
  isElectron: boolean;
}

const ProjectCard: React.FC<{
    project: CodeProject;
    onDelete: () => void;
    onInstall: () => void;
    onOpen: () => void;
    isBusy: boolean;
}> = ({ project, onDelete, onInstall, onOpen, isBusy }) => {
    return (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <CodeIcon className={`w-6 h-6 ${project.type === 'python' ? 'text-blue-500' : 'text-green-500'}`} />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{project.name}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {project.type}
                    </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">{project.path}</p>
            </div>
            <div className="flex items-center gap-2 mt-4">
                <button onClick={onInstall} disabled={isBusy} className="flex-1 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait">
                    {isBusy ? 'Working...' : 'Install Deps'}
                </button>
                <button onClick={onOpen} disabled={isBusy} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
                    <FolderOpenIcon className="w-4 h-4"/>
                </button>
                <button onClick={onDelete} disabled={isBusy} className="p-2 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
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


const ProjectsView: React.FC<ProjectsViewProps> = ({ config, onConfigChange, isElectron }) => {
    const [busyProjects, setBusyProjects] = useState<Set<string>>(new Set());
    
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
            const key = type === 'python' ? 'pythonProjectsPath' : 'nodejsProjectsPath';
            onConfigChange({...config, [key]: path});
        }
    };

    const handleCreateProject = async (projectType: ProjectType, name: string) => {
        const basePath = projectType === 'python' ? config.pythonProjectsPath : config.nodejsProjectsPath;
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
    
    const renderProjectSection = (type: ProjectType) => {
        const title = type === 'python' ? 'Python Projects' : 'Node.js Projects';
        const path = type === 'python' ? config.pythonProjectsPath : config.nodejsProjectsPath;
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
                            />
                       ))}
                    </div>
                    {path && projects.length === 0 && <p className="text-sm text-center py-4 text-gray-500 dark:text-gray-400">No {type} projects yet. Create one above.</p>}
                </div>
            </div>
        );
    }

  return (
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
      </div>
    </div>
  );
};

export default ProjectsView;
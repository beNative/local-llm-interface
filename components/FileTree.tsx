

import React, { useState, useEffect } from 'react';
import type { FileSystemEntry } from '../types';
import { logger } from '../services/logger';
import Icon from './Icon';

interface FileTreeItemProps {
  entry: FileSystemEntry;
  onFileClick: (entry: FileSystemEntry) => void;
  level: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ entry, onFileClick, level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fetchChildren = async () => {
      setIsLoading(true);
      try {
        const childEntries = await window.electronAPI!.readProjectDir(entry.path);
        setChildren(childEntries);
      } catch (e) {
        logger.error(`Failed to read directory ${entry.path}: ${e}`);
      } finally {
        setIsLoading(false);
      }
  };

  const handleToggle = async () => {
    if (!entry.isDirectory) return;

    if (isExpanded) {
      setIsExpanded(false);
    } else {
      await fetchChildren();
      setIsExpanded(true);
    }
  };

  const handleClick = () => {
    if (entry.isDirectory) {
      handleToggle();
    } else {
      onFileClick(entry);
    }
  };
  
  // Drag and Drop Handlers for adding files
  const handleDragEnter = (e: React.DragEvent) => {
    if (entry.isDirectory) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (entry.isDirectory) {
        e.preventDefault();
        e.stopPropagation();
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (entry.isDirectory) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!entry.isDirectory || !window.electronAPI) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const fileNames = Array.from(files).map(f => f.name).join('\n - ');
        const confirmationMessage = `Are you sure you want to add ${files.length} file(s) to the "${entry.name}" folder?\n\n- ${fileNames}`;

        if (window.confirm(confirmationMessage)) {
            logger.info(`User confirmed dropping ${files.length} file(s) into ${entry.path}`);
            try {
                const dropPromises = Array.from(files).map(file => 
                    window.electronAPI!.projectAddFileFromPath({
                        sourcePath: (file as any).path, // Electron provides the full path
                        targetDir: entry.path,
                    })
                );
                await Promise.all(dropPromises);
                logger.info('All files dropped successfully.');
                // Refresh the directory view
                if (isExpanded) {
                    await fetchChildren();
                } else {
                    await handleToggle();
                }
            } catch (err) {
                logger.error(`Error dropping files: ${err}`);
                alert(`Could not add files: ${err instanceof Error ? err.message : String(err)}`);
            }
        } else {
            logger.info('User canceled file drop operation.');
        }
    }
  };

  const MainIcon = entry.isDirectory ? 'folder' : 'file';
  const ExpanderIconName = isExpanded ? 'chevronDown' : 'chevronRight';

  return (
    <div>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        className={`flex items-center gap-2 py-1 px-2 rounded-md hover:bg-[--bg-hover] text-sm transition-colors ${
          isDragOver
            ? 'bg-[--accent-projects]/20 ring-2 ring-inset ring-[--accent-projects] cursor-copy'
            : 'cursor-pointer'
        }`}
      >
        {entry.isDirectory ? (
            isLoading ? <Icon name="spinner" className="w-4 h-4 flex-shrink-0" /> : <Icon name={ExpanderIconName} className="w-4 h-4 flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 flex-shrink-0" /> 
        )}
        <Icon name={MainIcon} className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span className="truncate text-[--text-secondary]">{entry.name}</span>
      </div>
      {isExpanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <FileTreeItem key={child.path} entry={child} onFileClick={onFileClick} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


interface FileTreeProps {
  projectPath: string;
  onFileClick: (entry: FileSystemEntry) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ projectPath, onFileClick }) => {
  const [rootEntries, setRootEntries] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRoot = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const entries = await window.electronAPI!.readProjectDir(projectPath);
        setRootEntries(entries);
      } catch (e) {
        const msg = `Failed to load project files: ${e instanceof Error ? e.message : String(e)}`;
        logger.error(msg);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    loadRoot();
  }, [projectPath]);

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-[--text-muted]">Loading files...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-sm text-red-500">{error}</div>;
  }
  
  if (rootEntries.length === 0) {
    return <div className="p-4 text-center text-sm text-[--text-muted]">This project is empty.</div>;
  }

  return (
    <div className="p-2 space-y-1">
      {rootEntries.map(entry => (
        <FileTreeItem key={entry.path} entry={entry} onFileClick={onFileClick} level={0} />
      ))}
    </div>
  );
};

export default FileTree;

import React, { useState, useEffect } from 'react';
import type { FileSystemEntry } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import FolderIcon from './icons/FolderIcon';
import FileIcon from './icons/FileIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { logger } from '../services/logger';

interface FileTreeItemProps {
  entry: FileSystemEntry;
  onFileClick: (entry: FileSystemEntry) => void;
  level: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ entry, onFileClick, level }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileSystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (!entry.isDirectory) return;

    if (isExpanded) {
      setIsExpanded(false);
    } else {
      setIsLoading(true);
      try {
        const childEntries = await window.electronAPI!.readProjectDir(entry.path);
        setChildren(childEntries);
        setIsExpanded(true);
      } catch (e) {
        logger.error(`Failed to read directory ${entry.path}: ${e}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClick = () => {
    if (entry.isDirectory) {
      handleToggle();
    } else {
      onFileClick(entry);
    }
  };
  
  const Icon = entry.isDirectory ? FolderIcon : FileIcon;
  const ExpanderIcon = isExpanded ? ChevronDownIcon : ChevronRightIcon;

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        className="flex items-center gap-2 py-1 px-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 text-sm"
      >
        {entry.isDirectory ? (
            isLoading ? <SpinnerIcon className="w-4 h-4 flex-shrink-0" /> : <ExpanderIcon className="w-4 h-4 flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 flex-shrink-0" /> 
        )}
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        <span className="truncate">{entry.name}</span>
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
    return <div className="p-4 text-center text-sm text-gray-500">Loading files...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-sm text-red-500">{error}</div>;
  }
  
  if (rootEntries.length === 0) {
    return <div className="p-4 text-center text-sm text-gray-500">This project is empty.</div>;
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
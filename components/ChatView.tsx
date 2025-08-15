
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Theme, CodeProject, ProjectType, FileSystemEntry, ChatSession, Model, ChatMessageContentPart, PredefinedPrompt } from '../types';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ModelIcon from './icons/ModelIcon';
import PlayIcon from './icons/PlayIcon';
import FilePlusIcon from './icons/FilePlusIcon';
import TerminalIcon from './icons/TerminalIcon';
import GlobeIcon from './icons/GlobeIcon';
import CodeIcon from './icons/CodeIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { runPythonCode } from '../services/pyodideService';
import { logger } from '../services/logger';
import StopIcon from './icons/StopIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import XIcon from './icons/XIcon';
import BookmarkIcon from './icons/BookmarkIcon';

const getProjectTypeForLang = (lang: string): ProjectType | null => {
    if (lang === 'python') return 'python';
    if (['javascript', 'js', 'nodejs'].includes(lang)) return 'nodejs';
    if (['html', 'html5'].includes(lang)) return 'webapp';
    if (lang === 'java') return 'java';
    if (['pascal', 'objectpascal', 'delphi'].includes(lang)) return 'delphi';
    return null;
}

interface SaveModalProps {
    code: string;
    lang: string;
    projects: CodeProject[];
    onClose: () => void;
}

const SaveToProjectModal: React.FC<SaveModalProps> = ({ code, lang, projects, onClose }) => {
    const projectType = getProjectTypeForLang(lang);
    const relevantProjects = projectType ? projects.filter(p => p.type === projectType) : [];
    const [selectedProjectId, setSelectedProjectId] = useState<string>(relevantProjects[0]?.id || '');
    const [filename, setFilename] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [existingFiles, setExistingFiles] = useState<FileSystemEntry[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    useEffect(() => {
        // Auto-detect filename from comment
        const firstLine = code.split('\n')[0];
        const match = /#\s*filename:\s*(\S+)|^\/\/\s*filename:\s*(\S+)|<!--\s*filename:\s*(\S+)\s*-->/.exec(firstLine);
        if (match) {
            setFilename(match[1] || match[2] || match[3] || '');
        } else {
            const extension = lang === 'python' ? 'py' : lang === 'html' ? 'html' : lang === 'java' ? 'java' : 'js';
            const defaultName = extension === 'html' ? 'index' : extension === 'java' ? 'Main' : `script-${new Date().toISOString().slice(0,10)}`;
            setFilename(`${defaultName}.${extension}`);
        }
    }, [code, lang]);

    useEffect(() => {
        // Fetch existing files when project changes
        if (!selectedProjectId) return;
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) return;
        
        const fetchFiles = async () => {
            setIsLoadingFiles(true);
            try {
                // For Java, we should suggest putting files in the correct source dir
                const dirToList = project.type === 'java' ? `${project.path}/src/main/java/com/example` : project.path;
                const files = await window.electronAPI!.readProjectDir(dirToList);
                setExistingFiles(files.filter(f => !f.isDirectory));
            } catch (e) {
                logger.error(`Failed to fetch project files: ${e}`);
                setExistingFiles([]);
            } finally {
                setIsLoadingFiles(false);
            }
        };
        fetchFiles();
    }, [selectedProjectId, projects]);

    const handleSave = async () => {
        if (!filename.trim() || !selectedProjectId) {
            alert('Please select a project and enter a valid filename.');
            return;
        }
        
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project) {
            alert('Selected project not found.');
            return;
        }

        const isOverwriting = existingFiles.some(f => f.name === filename.trim());
        if (isOverwriting) {
            if (!confirm(`The file "${filename.trim()}" already exists. Do you want to overwrite it?`)) {
                return;
            }
        }

        setIsSaving(true);
        const finalPath = project.type === 'java' 
            ? `${project.path}/src/main/java/com/example/${filename.trim()}`
            : `${project.path}/${filename.trim()}`;

        logger.info(`Saving file to "${finalPath}"...`);
        try {
            await window.electronAPI!.writeProjectFile(finalPath, code);
            logger.info(`Successfully saved file "${filename}" to project "${project.name}".`);
            onClose();
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logger.error(`An unexpected error occurred while saving file: ${errorMsg}`);
            alert(`An unexpected error occurred: ${errorMsg}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedFile = e.target.value;
        if (selectedFile) {
            setFilename(selectedFile);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[--text-primary] mb-4">Save Code to Project</h2>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="project-select" className="block text-sm font-medium text-[--text-muted] mb-1">Project</label>
                        <select
                            id="project-select"
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                        >
                            <option value="" disabled>-- Select a project --</option>
                            {relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="filename-input" className="block text-sm font-medium text-[--text-muted] mb-1">Filename</label>
                        <input
                            id="filename-input"
                            type="text"
                            value={filename}
                            onChange={e => setFilename(e.target.value)}
                            className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            placeholder="Enter new filename or select existing"
                        />
                    </div>
                     {selectedProjectId && !isLoadingFiles && existingFiles.length > 0 && (
                         <div>
                            <label htmlFor="file-select" className="block text-sm font-medium text-[--text-muted] mb-1">Or overwrite existing file</label>
                             <select
                                id="file-select"
                                onChange={handleFileSelect}
                                className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            >
                                <option value="">-- Choose a file to overwrite --</option>
                                {existingFiles.map(f => <option key={f.path} value={f.name}>{f.name}</option>)}
                            </select>
                         </div>
                     )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--text-secondary] bg-[--bg-tertiary] rounded-lg hover:bg-[--bg-hover]">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || !selectedProjectId || !filename.trim()} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400">
                        {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Save File'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CodeBlock = ({ node, inline, className, children, theme, isElectron, projects, onSaveRequest }: any) => {
  const [isCopied, setIsCopied] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('standalone');
  const [runState, setRunState] = useState<{
    isLoading: boolean;
    output: string | null;
    error: string | null;
  }>({
    isLoading: false,
    output: null,
    error: null,
  });

  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1].toLowerCase() : '';
  const isPython = lang === 'python';
  const isNode = ['javascript', 'js', 'nodejs'].includes(lang);
  const isWebApp = ['html', 'html5'].includes(lang);
  
  const codeText = String(children).replace(/\n$/, '');
  const syntaxTheme = theme === 'dark' ? atomDark : coy;
  
  const projectType = getProjectTypeForLang(lang);
  const canRunOrSaveNative = isElectron && projectType;
  const relevantProjects = projectType ? projects.filter((p: CodeProject) => p.type === projectType) : [];

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleRun = async () => {
    setRunState({ isLoading: true, output: null, error: null });

    const project = relevantProjects.find(p => p.id === selectedProjectId);
    const isStandalone = selectedProjectId === 'standalone' || !project;

    let executionEnv = '';
    if (isStandalone) {
        if (isWebApp) executionEnv = 'new browser window';
        else executionEnv = isPython ? (isElectron ? 'standalone Python' : 'Pyodide (WASM)') : 'standalone Node.js';
    } else {
        executionEnv = `project: ${project?.name}`;
    }
    logger.info(`Running ${lang} code via ${executionEnv}`);
    logger.debug(`Code:\n---\n${codeText}\n---`);

    try {
        if (!isElectron || !window.electronAPI) {
            // Browser-only fallbacks
            if (isPython) {
                const { result, error } = await runPythonCode(codeText);
                setRunState({ isLoading: false, output: result, error });
                logger.info(`Pyodide output:\n${result}`);
                if (error) logger.warn(`Pyodide error:\n${error}`);
            } else if (isWebApp) {
                setRunState({ isLoading: false, output: "Opening HTML snippets is only supported in the desktop app.", error: null });
            } else {
                 setRunState({ isLoading: false, output: "Running this code requires the desktop app.", error: null });
            }
            return;
        }

        // Electron API is available
        if (isStandalone) {
            let result: { stdout: string; stderr: string };
            if (isWebApp) {
                result = await window.electronAPI.runHtml(codeText);
            } else if (isPython) {
                result = await window.electronAPI.runPython(codeText);
            } else if (isNode) {
                result = await window.electronAPI.runNodejs(codeText);
            } else {
                return; // Should not be reached given canRunCode logic
            }
             setRunState({ isLoading: false, output: result.stdout, error: result.stderr || null });
             logger.info(`Standalone execution stdout:\n${result.stdout}`);
             if(result.stderr) logger.warn(`Standalone execution stderr:\n${result.stderr}`);
        } else { // In-project execution
            if (isWebApp) {
                setRunState({ isLoading: false, output: null, error: "Running HTML snippets within a project context is not supported. Please save the file and run the project instead." });
                return;
            }
            const result = await window.electronAPI.runScriptInProject({ project: project!, code: codeText });
            setRunState({ isLoading: false, output: result.stdout, error: result.stderr || null });
            logger.info(`In-project execution stdout:\n${result.stdout}`);
            if(result.stderr) logger.warn(`In-project execution stderr:\n${result.stderr}`);
        }
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setRunState({ isLoading: false, output: null, error: errorMsg });
        logger.error(`Failed to run code: ${errorMsg}`);
    }
  };
  
  const canRunCode = isPython || ((isNode || isWebApp) && isElectron);
  const RunIcon = isWebApp ? GlobeIcon : (isPython || isNode) && isElectron ? TerminalIcon : PlayIcon;
  const runButtonText = runState.isLoading ? 'Running...' : isWebApp ? 'Open in Browser' : 'Run';

  return !inline && match ? (
    <div className="not-prose relative bg-[--code-bg] my-2 rounded-lg border border-[--border-primary]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/5 dark:bg-white/5 rounded-t-lg text-xs">
        <span className="font-sans text-[--text-muted]">{match[1]}</span>
        <div className="flex items-center gap-2">
            {(canRunCode || canRunOrSaveNative) && (
              <div className="flex items-center divide-x divide-gray-300 dark:divide-gray-600">
                <div className="flex items-center gap-1 pr-2">
                    {isElectron && (isPython || isNode) && relevantProjects.length > 0 && (
                        <select 
                            value={selectedProjectId} 
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="text-xs bg-transparent border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500"
                            disabled={runState.isLoading}
                        >
                            <option value="standalone">Standalone</option>
                            {relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    {canRunCode && (
                        <button
                            onClick={handleRun}
                            disabled={runState.isLoading}
                            className="flex items-center gap-1.5 text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded disabled:cursor-not-allowed disabled:opacity-50"
                            title={isWebApp ? "Open HTML in a new browser window" : "Run code"}
                        >
                            <RunIcon className="w-3 h-3"/>
                            {runButtonText}
                        </button>
                    )}
                </div>
                <div className="pl-2 flex items-center gap-2">
                    {canRunOrSaveNative && relevantProjects.length > 0 && (
                         <button onClick={() => onSaveRequest(codeText, lang)} className="flex items-center gap-1.5 text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded" title="Save to Project">
                            <FilePlusIcon className="w-3.5 h-3.5" />
                            Save
                        </button>
                    )}
                    <button 
                      onClick={handleCopy}
                      className="text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded"
                    >
                      {isCopied ? 'Copied!' : 'Copy code'}
                    </button>
                </div>
              </div>
            )}
            {!(canRunCode || canRunOrSaveNative) && (
                <button 
                  onClick={handleCopy}
                  className="text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded"
                >
                  {isCopied ? 'Copied!' : 'Copy code'}
                </button>
            )}
        </div>
      </div>
      <SyntaxHighlighter
        style={syntaxTheme}
        language={match[1]}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', overflowX: 'auto' }}
      >
        {codeText}
      </SyntaxHighlighter>
      {(runState.output || runState.error) && (
        <div className="border-t border-[--border-primary] p-4 font-mono text-xs bg-[--code-output-bg] rounded-b-lg">
           <h4 className="text-[--text-muted] font-sans font-semibold text-sm mb-2">Output</h4>
           {runState.output && (
             <pre className="whitespace-pre-wrap text-[--text-secondary]">{runState.output}</pre>
           )}
           {runState.error && (
             <pre className="whitespace-pre-wrap text-red-500">{runState.error}</pre>
           )}
        </div>
      )}
    </div>
  ) : (
    <code className="not-prose px-1.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-sm font-mono">
      {children}
    </code>
  );
};

interface ChatViewProps {
  session: ChatSession;
  onSendMessage: (content: string | ChatMessageContentPart[]) => void;
  isResponding: boolean;
  onStopGeneration: () => void;
  onRenameSession: (newName: string) => void;
  theme: Theme;
  isElectron: boolean;
  projects: CodeProject[];
  predefinedInput: string;
  onPrefillConsumed: () => void;
  activeProjectId: string | null;
  onSetActiveProject: (projectId: string | null) => void;
  models: Model[];
  onSelectModel: (modelId: string) => void;
  predefinedPrompts: PredefinedPrompt[];
}

const ChatView: React.FC<ChatViewProps> = ({ session, onSendMessage, isResponding, onStopGeneration, onRenameSession, theme, isElectron, projects, predefinedInput, onPrefillConsumed, activeProjectId, onSetActiveProject, models, onSelectModel, predefinedPrompts }) => {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [saveModalState, setSaveModalState] = useState<{ code: string; lang: string } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.name);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptsPopoverRef = useRef<HTMLDivElement>(null);
  const promptsButtonRef = useRef<HTMLButtonElement>(null);

  const { messages, name: sessionName } = session;

  useEffect(() => {
    setEditedTitle(sessionName);
  }, [sessionName]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
            setIsModelSelectorOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modelSelectorRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            promptsPopoverRef.current && 
            !promptsPopoverRef.current.contains(event.target as Node) &&
            promptsButtonRef.current &&
            !promptsButtonRef.current.contains(event.target as Node)
        ) {
            setIsPromptsOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (predefinedInput) {
      setInput(predefinedInput);
      onPrefillConsumed();
    }
  }, [predefinedInput, onPrefillConsumed]);

  useEffect(() => {
    if (!isResponding) {
      // Use a timeout to ensure focus is set after any other state updates,
      // which can be necessary when navigating between complex views.
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isResponding]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
        // We need to reset the height momentarily to get the correct scrollHeight.
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if ((!input.trim() && !attachedImage) || isResponding) return;

    if (attachedImage) {
        const contentParts: ChatMessageContentPart[] = [];
        if (input.trim()) {
            contentParts.push({ type: 'text', text: input.trim() });
        }
        contentParts.push({ type: 'image_url', image_url: { url: attachedImage } });
        onSendMessage(contentParts);
    } else {
        onSendMessage(input.trim());
    }
    
    setInput('');
    setAttachedImage(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachedImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleTitleRename = () => {
    if (editedTitle.trim() && editedTitle.trim() !== session.name) {
      onRenameSession(editedTitle.trim());
    } else {
      setEditedTitle(session.name);
    }
    setIsEditingTitle(false);
  };
  
  const handleSaveRequest = (code: string, lang: string) => {
    setSaveModalState({ code, lang });
  };

  const handleSelectPrompt = (promptContent: string) => {
    setInput(promptContent);
    setIsPromptsOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-[--bg-primary]">
     {saveModalState && isElectron && (
        <SaveToProjectModal 
            {...saveModalState}
            projects={projects}
            onClose={() => setSaveModalState(null)}
        />
     )}
      <header className="flex items-center justify-between p-4 bg-[--bg-primary] border-b border-[--border-primary] gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <ModelIcon className="w-6 h-6 text-[--accent-chat] flex-shrink-0"/>
          <div className="flex flex-col min-w-0">
            {isEditingTitle ? (
              <input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleTitleRename}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleRename()}
                className="text-lg font-semibold bg-transparent border-b border-[--border-focus] focus:outline-none text-[--text-primary] w-full"
              />
            ) : (
              <h2 
                className="text-lg font-semibold text-[--text-primary] truncate cursor-pointer hover:bg-[--bg-hover] px-2 -ml-2 py-1 rounded-lg"
                title="Click to rename"
                onClick={() => setIsEditingTitle(true)}
              >
                {session.name}
              </h2>
            )}
            <div className="relative" ref={modelSelectorRef}>
                <button 
                    onClick={() => setIsModelSelectorOpen(prev => !prev)} 
                    className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] px-2 -ml-2 py-0.5 rounded-lg hover:bg-[--bg-hover]"
                    title="Start new chat with a different model"
                >
                    <span className="truncate max-w-xs">Using: {session.modelId}</span>
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isModelSelectorOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs font-semibold text-[--text-muted] border-b border-[--border-primary]">Start new chat with:</div>
                        {models.map(model => (
                            <button 
                                key={model.id}
                                onClick={() => {
                                    onSelectModel(model.id);
                                    setIsModelSelectorOpen(false);
                                }}
                                className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                            >
                                {model.id}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>
        </div>
        {isElectron && projects.length > 0 && (
          <div className="flex items-center gap-2 flex-grow justify-end min-w-0">
            <label htmlFor="project-context-select" className="flex-shrink-0 text-sm text-[--text-muted] flex items-center gap-1.5">
              <CodeIcon className="w-5 h-5" />
              <span>Context:</span>
            </label>
            <select
              id="project-context-select"
              value={activeProjectId || ''}
              onChange={(e) => onSetActiveProject(e.target.value || null)}
              className="text-sm text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus] w-full max-w-xs truncate"
              aria-label="Select active project for context"
            >
              <option value="">No Project Context</option>
              {projects.map(p => {
                const projectTypeText = p.type.charAt(0).toUpperCase() + p.type.slice(1);
                const optionText = `${p.name} (${projectTypeText})`;
                return <option key={p.id} value={p.id} title={optionText}>{optionText}</option>
              })}
            </select>
          </div>
        )}
      </header>
      <main
        className="flex-1 overflow-y-auto p-6 space-y-6"
        style={{
            backgroundColor: 'var(--chat-bg-color)',
            fontFamily: 'var(--chat-font-family)',
            fontSize: 'var(--chat-font-size)',
        }}
       >
        {messages.filter(m => m.role !== 'system').map((msg, index) => (
          <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center"><ModelIcon className="w-5 h-5 text-[--accent-chat]" /></div>}
            <div
              style={{
                backgroundColor: msg.role === 'user' ? 'var(--user-message-bg-color)' : 'var(--assistant-message-bg-color)',
                color: msg.role === 'user' ? 'var(--user-message-text-color)' : 'var(--assistant-message-text-color)',
                backgroundImage: msg.role === 'user' ? 'var(--user-message-bg-image)' : 'none',
              }}
              className={`p-4 rounded-2xl shadow-sm ${
                msg.role === 'user'
                  ? 'rounded-br-lg'
                  : 'rounded-bl-lg'
              }`}
            >
              {msg.role === 'assistant' ? (
                msg.content === '' && isResponding ? (
                  <SpinnerIcon className="w-5 h-5 text-gray-400"/>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                          code: (props) => (
                              <CodeBlock {...props} theme={theme} isElectron={isElectron} projects={projects} onSaveRequest={handleSaveRequest} />
                          ),
                          pre: ({ children }) => <>{children}</>,
                      }}
                    >
                      {msg.content as string}
                    </ReactMarkdown>
                  </div>
                )
              ) : ( // User message
                <div className="space-y-2">
                  {Array.isArray(msg.content) ? (
                    msg.content.map((part, i) => {
                      if (part.type === 'image_url') {
                        return <img key={i} src={part.image_url.url} className="max-w-xs rounded-lg" alt="User upload" />;
                      }
                      if (part.type === 'text') {
                        return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                      }
                      return null;
                    })
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              )}
            </div>
             {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center font-bold text-[--text-primary]">U</div>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-4 bg-[--bg-primary] border-t border-[--border-primary]">
        {attachedImage && (
            <div className="relative w-20 h-20 mb-2 border border-[--border-secondary] rounded-lg p-1">
                <img src={attachedImage} className="w-full h-full object-cover rounded-md" alt="Attachment preview"/>
                <button 
                    onClick={() => setAttachedImage(null)} 
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors"
                    aria-label="Remove image"
                    title="Remove image"
                >
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
        )}
        <div className="relative">
           <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
           />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message, or attach an image..."
            rows={1}
            disabled={isResponding}
            className="w-full pl-24 pr-14 py-3 bg-[--bg-tertiary] text-[--text-primary] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[--border-focus] disabled:cursor-not-allowed max-h-48 overflow-y-auto"
          />
          <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isResponding}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary] disabled:opacity-50"
              title="Attach image"
          >
              <PaperclipIcon className="w-5 h-5" />
          </button>
          <div className="absolute left-12 top-1/2 -translate-y-1/2">
            <button
                ref={promptsButtonRef}
                onClick={() => setIsPromptsOpen(prev => !prev)}
                disabled={isResponding || predefinedPrompts.length === 0}
                className="p-2 rounded-full text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed"
                title="Use a predefined prompt"
            >
                <BookmarkIcon className="w-5 h-5" />
            </button>
            {isPromptsOpen && predefinedPrompts.length > 0 && (
              <div 
                ref={promptsPopoverRef}
                className="absolute bottom-full mb-2 w-72 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto"
              >
                <div className="p-2 text-xs font-semibold text-[--text-muted] border-b border-[--border-primary]">Select a prompt</div>
                {predefinedPrompts.map(prompt => (
                  <button 
                    key={prompt.id}
                    onClick={() => handleSelectPrompt(prompt.content)}
                    className="w-full text-left block px-3 py-2 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                    title={prompt.content}
                  >
                    <p className="font-semibold truncate">{prompt.title}</p>
                    <p className="text-xs text-[--text-muted] truncate mt-0.5">{prompt.content}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {isResponding ? (
            <button
              onClick={onStopGeneration}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
              title="Stop generating"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && !attachedImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-[--accent-chat] text-white hover:brightness-90 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition-all"
              title="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ChatView;
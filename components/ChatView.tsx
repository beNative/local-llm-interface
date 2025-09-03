import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Theme, CodeProject, ProjectType, FileSystemEntry, ChatSession, Model, ChatMessageContentPart, PredefinedPrompt, ChatMessageMetadata, SystemPrompt, GenerationConfig, LLMProviderConfig } from '../types';
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
import IdentityIcon from './icons/IdentityIcon';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import FileModificationView from './FileModificationView';
import CheckIcon from './icons/CheckIcon';
import XCircleIcon from './icons/XCircleIcon';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import FileCodeIcon from './icons/FileCodeIcon';
import SlidersIcon from './icons/SlidersIcon';
import SparklesIcon from './icons/SparklesIcon';
import ProviderIcon from './ProviderIcon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

const ContextSources: React.FC<{ files: string[] }> = ({ files }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!files || files.length === 0) return null;

    const fileNames = files.map(f => f.split(/[/\\]/).pop());

    return (
        <div className="mb-2 text-xs border border-[--assistant-message-text-color]/10 rounded-lg">
            <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex items-center w-full p-2 text-left opacity-80 hover:opacity-100"
            >
                <FileCodeIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="font-semibold flex-grow">Context from {files.length} files</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="p-2 border-t border-[--assistant-message-text-color]/10 font-mono">
                    {fileNames.map((name, index) => {
                        const tooltipProps = useTooltipTrigger(files[index]);
                        return <div key={index} {...tooltipProps} className="truncate">{name}</div>
                    })}
                </div>
            )}
        </div>
    );
};

const ThinkingLog: React.FC<{ content: string }> = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!content) return null;

    return (
        <div className="mb-2 text-xs border border-[--assistant-message-text-color]/10 rounded-lg">
            <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex items-center w-full p-2 text-left opacity-80 hover:opacity-100"
            >
                <BrainCircuitIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="font-semibold flex-grow">Show reasoning</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="p-2 border-t border-[--assistant-message-text-color]/10 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};


const MessageMetadata: React.FC<{ metadata: ChatMessageMetadata }> = ({ metadata }) => {
    const { usage, speed } = metadata;

    const stats: string[] = [];
    if (usage?.prompt_tokens !== undefined) {
        stats.push(`Input: ${usage.prompt_tokens} tokens`);
    }
    if (usage?.completion_tokens !== undefined) {
        stats.push(`Output: ${usage.completion_tokens} tokens`);
    }
    if (speed !== undefined) {
        stats.push(`Speed: ${speed.toFixed(1)} t/s`);
    }

    if (stats.length === 0) return null;

    return (
        <div className="mt-3 pt-2 border-t border-[--assistant-message-text-color]/10 text-xs font-mono opacity-70">
            {stats.join('  •  ')}
        </div>
    );
};

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
    activeProjectId: string | null;
}

const SaveToProjectModal: React.FC<SaveModalProps> = ({ code, lang, projects, onClose, activeProjectId }) => {
    const projectType = getProjectTypeForLang(lang);
    const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
    
    // If a project context is active, that's the only relevant project.
    // Otherwise, find projects matching the code's language type.
    const relevantProjects = activeProject 
        ? [activeProject] 
        : projectType ? projects.filter(p => p.type === projectType) : [];

    const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || relevantProjects[0]?.id || '');
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

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm" onClick={handleBackdropClick}>
            <div className="bg-[--bg-secondary] rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-[--text-primary] mb-4">Save Code to Project</h2>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="project-select" className="block text-sm font-medium text-[--text-muted] mb-1">Project</label>
                        {activeProject ? (
                            <div className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg">
                                {activeProject.name}
                                <p className="text-xs text-[--text-muted]">Saving to active project context</p>
                            </div>
                        ) : (
                            <select
                                id="project-select"
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                                className="w-full px-3 py-2 text-[--text-primary] bg-[--bg-tertiary] border border-[--border-secondary] rounded-lg focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
                            >
                                <option value="" disabled>-- Select a project --</option>
                                {relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        )}
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

const detectLang = (code: string): string => {
    // Check for explicit filename comments first as a strong signal
    const firstLine = code.split('\n')[0].toLowerCase();
    if (firstLine.includes('filename:')) {
        if (firstLine.endsWith('.py')) return 'python';
        if (firstLine.endsWith('.js') || firstLine.endsWith('.ts')) return 'javascript';
        if (firstLine.endsWith('.html') || firstLine.endsWith('.htm')) return 'html';
        if (firstLine.endsWith('.java')) return 'java';
        if (firstLine.endsWith('.dpr') || firstLine.endsWith('.pas')) return 'delphi';
    }
    
    const lowerCaseCode = code.toLowerCase();

    // High-confidence checks for languages with distinct keywords
    if (lowerCaseCode.match(/\b(public class|public static void main|system\.out\.println|import java\.)/)) return 'java';
    if (lowerCaseCode.match(/\b(program|unit|interface|implementation|uses|begin|end\.|procedure|function)\b/)) return 'delphi';
    if (lowerCaseCode.match(/<!doctype html>|<html|<head|<body|<div|<p|<span|<a\s+href/)) return 'html';
    
    // Python is very common, so check for its unique constructs
    if (lowerCaseCode.match(/if __name__ == "__main__":/)) return 'python';
    if (lowerCaseCode.match(/\b(def|import|from|class|elif|lambda|yield|async def)\s/)) return 'python';

    // JavaScript is also common
    if (lowerCaseCode.match(/\b(const|let|var|function|return|import|export|async|await|document\.get|console\.log)\b/)) return 'javascript';
    if (lowerCaseCode.includes('=>')) return 'javascript'; // Arrow functions are a strong signal

    // If we find `print()`, it's likely python but could be others.
    // This is a lower-confidence check.
    if (lowerCaseCode.includes('print(') && !lowerCaseCode.includes('system.out.println')) return 'python';

    return ''; // Fallback for no detection
};

const CodeBlock = React.memo(({ node, inline, className, children, theme, isElectron, projects, onSaveRequest, activeProjectId, onFixRequest }: any) => {
  const [isCopied, setIsCopied] = useState(false);
  const [runState, setRunState] = useState<{
    isLoading: boolean;
    output: string | null;
    error: string | null;
  }>({
    isLoading: false,
    output: null,
    error: null,
  });

  const copyTooltip = useTooltipTrigger(isCopied ? 'Copied!' : 'Copy code to clipboard');
  const saveTooltip = useTooltipTrigger('Save to Project');

  const codeText = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  
  // UseMemo will prevent re-detecting on every render unless the code itself changes.
  const lang = useMemo(() => {
    if (match) return match[1].toLowerCase();
    return detectLang(codeText);
  }, [className, codeText, match]);

  const isPython = lang === 'python';
  const isNode = ['javascript', 'js', 'nodejs'].includes(lang);
  const isWebApp = ['html', 'html5'].includes(lang);
  
  const syntaxTheme = theme === 'dark' ? atomDark : coy;
  
  const projectType = getProjectTypeForLang(lang);
  const relevantProjects = projectType ? projects.filter((p: CodeProject) => p.type === projectType) : [];
  
  // Can save if we are in Electron and either a project context is active or there are relevant projects for this language
  const canSave = isElectron && (activeProjectId || relevantProjects.length > 0);
  const canRunCode = isPython || ((isNode || isWebApp) && isElectron);
  
  const activeProject = activeProjectId ? projects.find((p: CodeProject) => p.id === activeProjectId) : null;
  const isRunnableInProject = activeProject && activeProject.type === getProjectTypeForLang(lang);
  const executionContextName = isRunnableInProject ? activeProject.name : 'Standalone';

  const runTooltip = useTooltipTrigger(isWebApp ? "Open HTML in a new browser window" : `Run code in ${executionContextName} context`);
  const contextTooltip = useTooltipTrigger(`Execution context: ${executionContextName}`);


  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleRun = async () => {
    setRunState({ isLoading: true, output: null, error: null });

    // WebApps can't run "in project", they are always "standalone" (opened in new browser window).
    const runInProject = isRunnableInProject && !isWebApp;

    let executionEnv = '';
    if (runInProject) {
        executionEnv = `project: ${activeProject!.name}`;
    } else {
        if (isWebApp) executionEnv = 'new browser window';
        else executionEnv = isPython ? (isElectron ? 'standalone Python' : 'Pyodide (WASM)') : 'standalone Node.js';
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
        if (!runInProject) { // Standalone execution
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
            const result = await window.electronAPI.runScriptInProject({ project: activeProject!, code: codeText });
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
  
  const RunIcon = isWebApp ? GlobeIcon : TerminalIcon;
  const runButtonText = runState.isLoading ? 'Running...' : isWebApp ? 'Open in Browser' : 'Run';

  if (inline) {
    return (
        <code className="not-prose px-1.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md text-sm font-mono">
          {children}
        </code>
      );
  }

  return (
    <div className="not-prose relative bg-[--code-bg] my-2 rounded-lg border border-[--border-primary]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-black/5 dark:bg-white/5 rounded-t-lg text-xs">
        <span className="font-sans text-[--text-muted]">{lang || 'code'}</span>
        <div className="flex items-center gap-2">
          <button 
            {...copyTooltip}
            onClick={handleCopy}
            className="text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded"
          >
            {isCopied ? 'Copied!' : 'Copy code'}
          </button>
          {canSave && (
            <button {...saveTooltip} onClick={() => onSaveRequest(codeText, lang)} className="flex items-center gap-1.5 text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded">
              <FilePlusIcon className="w-3.5 h-3.5" />
              Save
            </button>
          )}
          {canRunCode && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-300 dark:border-gray-600">
              {isElectron && (isPython || isNode) && (
                <div {...contextTooltip} className="flex items-center gap-1.5 text-xs px-2 py-1 text-[--text-muted] bg-[--bg-tertiary]/80 border border-[--border-secondary]/50 rounded-md">
                    <TerminalIcon className="w-3 h-3" />
                    <span>{executionContextName}</span>
                </div>
              )}
              <button
                  {...runTooltip}
                  onClick={handleRun}
                  disabled={runState.isLoading}
                  className="flex items-center gap-1.5 text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded disabled:cursor-not-allowed disabled:opacity-50"
              >
                  <RunIcon className="w-3 h-3"/>
                  {runButtonText}
              </button>
            </div>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        style={syntaxTheme}
        language={lang || 'text'}
        PreTag="div"
        customStyle={{ margin: 0, padding: '1rem', background: 'transparent', overflowX: 'auto' }}
      >
        {codeText}
      </SyntaxHighlighter>
      {(runState.output !== null || runState.error !== null) && (
        <div className="border-t border-[--border-primary] bg-[--code-output-bg] rounded-b-lg">
          <div className="p-4 font-mono text-xs">
            <h4 className="text-[--text-muted] font-sans font-semibold text-sm mb-2">Output</h4>
            {runState.output !== null && runState.output !== '' && (
             <pre className="whitespace-pre-wrap text-[--text-secondary]">{runState.output}</pre>
            )}
            {runState.error && (
             <pre className="whitespace-pre-wrap text-red-500">{runState.error}</pre>
            )}
            {runState.output === '' && !runState.error && (
             <p className="text-[--text-muted] italic font-sans">Command executed successfully with no output.</p>
            )}
          </div>
          {runState.error && (
            <div className="border-t border-[--border-primary] px-4 py-2 bg-black/5 dark:bg-black/10">
                <button
                    onClick={() => onFixRequest(codeText, lang, runState.error!)}
                    className="flex items-center gap-1.5 text-sm text-[--text-muted] hover:text-[--text-primary] px-2 py-1 rounded transition-colors"
                >
                    <SparklesIcon className="w-4 h-4 text-purple-500" />
                    <span className="font-sans font-medium">Ask AI to Fix</span>
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const MemoizedChatMessage = React.memo<{
  msg: ChatMessage;
  prevMessage: ChatMessage | undefined;
  markdownComponents: ReturnType<typeof useMemo>;
  onAcceptModification: (filePath: string, newContent: string) => void;
  onRejectModification: (filePath: string) => void;
  theme: Theme;
  isResponding: boolean;
}>(({ msg, prevMessage, markdownComponents, onAcceptModification, onRejectModification, theme, isResponding }) => {
  const isModificationResponse = msg.role === 'assistant' && prevMessage?.role === 'user' && prevMessage.fileModification;

  if (isModificationResponse) {
    const modInfo = prevMessage.fileModification!;
    const fileName = modInfo.filePath.split(/[/\\]/).pop();

    return (
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center"><ModelIcon className="w-5 h-5 text-[--accent-chat]" /></div>
        <div className="flex-1 min-w-0">
          {modInfo.status === 'pending' && (
            <FileModificationView
              filePath={modInfo.filePath}
              newContent={msg.content as string}
              onAccept={(newContent) => onAcceptModification(modInfo.filePath, newContent)}
              onReject={() => onRejectModification(modInfo.filePath)}
              theme={theme}
            />
          )}
          {modInfo.status === 'accepted' && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 p-3 bg-green-100 dark:bg-green-900/50 rounded-lg border border-green-200 dark:border-green-800">
              <CheckIcon className="w-5 h-5" />
              <span>Changes successfully applied to <strong>{fileName}</strong>.</span>
            </div>
          )}
          {modInfo.status === 'rejected' && (
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-500 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800">
              <XCircleIcon className="w-5 h-5" />
              <span>Changes for <strong>{fileName}</strong> were rejected.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
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
            <>
              {msg.metadata?.thinking && <ThinkingLog content={msg.metadata.thinking} />}
              {msg.metadata?.ragContext && <ContextSources files={msg.metadata.ragContext.files} />}
              <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {msg.content as string}
                </ReactMarkdown>
              </div>
              {msg.metadata && <MessageMetadata metadata={msg.metadata} />}
            </>
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
  );
});

const ThinkingIndicator: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center">
        <BrainCircuitIcon className="w-5 h-5 text-[--accent-chat] animate-pulse" />
      </div>
      <div className="p-4 rounded-2xl rounded-bl-lg shadow-sm w-full bg-[--assistant-message-bg-color] border border-[--border-primary]">
        <h4 className="font-semibold text-sm text-[--assistant-message-text-color]/80 mb-2 flex items-center gap-2">
          <SpinnerIcon className="w-4 h-4" />
          Thinking...
        </h4>
        <div className="prose prose-sm max-w-none text-[--assistant-message-text-color]/90 max-h-48 overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

interface ChatViewProps {
  session: ChatSession;
  provider: LLMProviderConfig | null;
  onSendMessage: (content: string | ChatMessageContentPart[], options?: { useRAG: boolean }) => void;
  isResponding: boolean;
  retrievalStatus: 'idle' | 'retrieving';
  thinkingText: string | null;
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
  systemPrompts: SystemPrompt[];
  onSetSessionSystemPrompt: (systemPromptId: string | null) => void;
  onSetSessionGenerationConfig: (generationConfig: GenerationConfig) => void;
  onAcceptModification: (filePath: string, newContent: string) => void;
  onRejectModification: (filePath: string) => void;
}

// FIX: Changed from a const assignment to a function declaration with a default export
// to resolve a "no default export" error in the App component.
export default function ChatView({ session, provider, onSendMessage, isResponding, retrievalStatus, thinkingText, onStopGeneration, onRenameSession, theme, isElectron, projects, predefinedInput, onPrefillConsumed, activeProjectId, onSetActiveProject, models, onSelectModel, predefinedPrompts, systemPrompts, onSetSessionSystemPrompt, onSetSessionGenerationConfig, onAcceptModification, onRejectModification }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [saveModalState, setSaveModalState] = useState<{ code: string; lang: string; activeProjectId: string | null } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.name);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSmartContextEnabled, setIsSmartContextEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const personaSelectorRef = useRef<HTMLDivElement>(null);
  const paramsSelectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptsPopoverRef = useRef<HTMLDivElement>(null);
  const promptsButtonRef = useRef<HTMLButtonElement>(null);

  const { messages, name: sessionName } = session;
  
  const currentSystemPrompt = systemPrompts.find(p => p.id === session.systemPromptId);
  const currentPersonaName = currentSystemPrompt ? currentSystemPrompt.title : 'Default Assistant';
  const currentPersonaContent = currentSystemPrompt ? currentSystemPrompt.content : DEFAULT_SYSTEM_PROMPT;
  
  const titleTooltip = useTooltipTrigger("Click to rename");
  const modelTooltip = useTooltipTrigger("Start new chat with a different model");
  const personaTooltip = useTooltipTrigger(currentPersonaContent);
  const paramsTooltip = useTooltipTrigger("Adjust model parameters");
  const projectContextTooltip = useTooltipTrigger("Select a project to enable project-aware features like file modification and smart context.");
  const smartContextTooltip = useTooltipTrigger("When enabled, the AI will first analyze your prompt to find the most relevant files in the selected project. It will then read their content to provide a more accurate, context-aware answer.");
  const removeImgTooltip = useTooltipTrigger("Remove image");
  const attachImgTooltip = useTooltipTrigger("Attach image");
  const predefinedPromptsTooltip = useTooltipTrigger("Use a predefined prompt");
  const stopGenTooltip = useTooltipTrigger("Stop generating");
  const sendMsgTooltip = useTooltipTrigger("Send message");
  

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
        if (personaSelectorRef.current && !personaSelectorRef.current.contains(event.target as Node)) {
            setIsPersonaSelectorOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [personaSelectorRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (paramsSelectorRef.current && !paramsSelectorRef.current.contains(event.target as Node)) {
            setIsParamsOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [paramsSelectorRef]);

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
  }, [messages, thinkingText]);
  
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
        onSendMessage(contentParts, { useRAG: isSmartContextEnabled });
    } else {
        onSendMessage(input.trim(), { useRAG: isSmartContextEnabled });
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
  
  const handleImageChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
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
  
  const handleSaveRequest = useCallback((code: string, lang: string) => {
    setSaveModalState({ code, lang, activeProjectId });
  }, [activeProjectId]);

  const handleFixRequest = useCallback((code: string, lang: string, error: string) => {
    const prompt = `The following ${lang} code failed to execute:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nIt produced this error:\n\n\`\`\`\n${error}\n\`\`\`\n\nPlease provide the corrected, complete code block and explain the fix.`;
    onSendMessage(prompt, { useRAG: isSmartContextEnabled });
  }, [onSendMessage, isSmartContextEnabled]);

  const handleSelectPrompt = (promptContent: string) => {
    setInput(promptContent);
    setIsPromptsOpen(false);
    textareaRef.current?.focus();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Use relatedTarget to prevent flickering when moving over child elements
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
      }
      setIsDraggingOver(false);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          handleImageChange(file);
          e.dataTransfer.clearData();
      }
  };

  const handleParamChange = (param: keyof GenerationConfig, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    const newConfig = {
        ...session.generationConfig,
        [param]: numValue
    };
    onSetSessionGenerationConfig(newConfig);
  };
  
  const handleResetParams = () => {
    onSetSessionGenerationConfig({
        temperature: 0.8,
        topK: 40,
        topP: 0.9,
    });
    setIsParamsOpen(false);
  };
  
  const markdownComponents = useMemo(() => ({
    code: (props: any) => (
        <CodeBlock {...props} theme={theme} isElectron={isElectron} projects={projects} onSaveRequest={handleSaveRequest} activeProjectId={activeProjectId} onFixRequest={handleFixRequest} />
    ),
    pre: ({ children }: any) => <>{children}</>,
  }), [theme, isElectron, projects, handleSaveRequest, activeProjectId, handleFixRequest]);

  const filteredMessages = useMemo(() => messages.filter(m => m.role !== 'system'), [messages]);

  return (
    <div 
        className="relative flex flex-col h-full bg-[--bg-primary]"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
     {saveModalState && isElectron && (
        <SaveToProjectModal 
            {...saveModalState}
            projects={projects}
            onClose={() => setSaveModalState(null)}
        />
     )}
      <header className="flex items-center justify-between p-4 bg-[--bg-primary] border-b border-[--border-primary] gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <ProviderIcon provider={provider} className="w-6 h-6 text-[--accent-chat] flex-shrink-0"/>
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
                {...titleTooltip}
                className="text-lg font-semibold text-[--text-primary] truncate cursor-pointer hover:bg-[--bg-hover] px-2 -ml-2 py-1 rounded-lg"
                onClick={() => setIsEditingTitle(true)}
              >
                {session.name}
              </h2>
            )}
            <div className='flex items-center gap-3'>
              <div className="relative" ref={modelSelectorRef}>
                  <button 
                      {...modelTooltip}
                      onClick={() => setIsModelSelectorOpen(prev => !prev)} 
                      className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] px-2 -ml-2 py-0.5 rounded-lg hover:bg-[--bg-hover]"
                  >
                      <span className="truncate max-w-xs">{provider?.name} / {session.modelId}</span>
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
               <div className="relative" ref={personaSelectorRef}>
                <button 
                    {...personaTooltip}
                    onClick={() => setIsPersonaSelectorOpen(prev => !prev)} 
                    className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] px-2 -ml-2 py-0.5 rounded-lg hover:bg-[--bg-hover]"
                >
                    <IdentityIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-xs">Persona: {currentPersonaName}</span>
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${isPersonaSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isPersonaSelectorOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-64 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs font-semibold text-[--text-muted] border-b border-[--border-primary]">Select a Persona</div>
                        <button 
                            onClick={() => {
                                onSetSessionSystemPrompt(null);
                                setIsPersonaSelectorOpen(false);
                            }}
                            className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                        >
                            Default Assistant
                        </button>
                        {systemPrompts.map(prompt => {
                            const promptTooltip = useTooltipTrigger(prompt.content);
                            return (
                                <button 
                                    {...promptTooltip}
                                    key={prompt.id}
                                    onClick={() => {
                                        onSetSessionSystemPrompt(prompt.id);
                                        setIsPersonaSelectorOpen(false);
                                    }}
                                    className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
                                >
                                    {prompt.title}
                                </button>
                            )
                        })}
                    </div>
                )}
              </div>
               <div className="relative" ref={paramsSelectorRef}>
                <button 
                    {...paramsTooltip}
                    onClick={() => setIsParamsOpen(prev => !prev)} 
                    className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] px-2 -ml-2 py-0.5 rounded-lg hover:bg-[--bg-hover]"
                >
                    <SlidersIcon className="w-3.5 h-3.5" />
                    <span>Parameters</span>
                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${isParamsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isParamsOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-semibold text-[--text-secondary]">Generation Parameters</h4>
                            <button onClick={handleResetParams} className="text-xs text-[--text-muted] hover:underline">Reset</button>
                        </div>
                        
                        <div>
                            <label htmlFor="temperature" className="flex justify-between text-xs text-[--text-muted] mb-1">
                                <span>Temperature</span>
                                <span className="font-mono">{session.generationConfig?.temperature?.toFixed(2) ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                id="temperature"
                                min="0" max="2" step="0.01"
                                value={session.generationConfig?.temperature ?? 0.8}
                                onChange={e => handleParamChange('temperature', e.target.value)}
                                className="w-full h-2 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer"
                            />
                             <p className="text-xs text-[--text-muted]/70 mt-1">Controls randomness. Lower is more deterministic.</p>
                        </div>
                        
                        <div>
                            <label htmlFor="topK" className="flex justify-between text-xs text-[--text-muted] mb-1">
                                <span>Top-K</span>
                                <span className="font-mono">{session.generationConfig?.topK ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                id="topK"
                                min="1" max="100" step="1"
                                value={session.generationConfig?.topK ?? 40}
                                onChange={e => handleParamChange('topK', e.target.value)}
                                className="w-full h-2 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer"
                            />
                             <p className="text-xs text-[--text-muted]/70 mt-1">Considers the top K most likely tokens.</p>
                        </div>

                        <div>
                            <label htmlFor="topP" className="flex justify-between text-xs text-[--text-muted] mb-1">
                                <span>Top-P</span>
                                <span className="font-mono">{session.generationConfig?.topP?.toFixed(2) ?? 'N/A'}</span>
                            </label>
                            <input
                                type="range"
                                id="topP"
                                min="0" max="1" step="0.01"
                                value={session.generationConfig?.topP ?? 0.9}
                                onChange={e => handleParamChange('topP', e.target.value)}
                                className="w-full h-2 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer"
                            />
                             <p className="text-xs text-[--text-muted]/70 mt-1">Nucleus sampling. Considers tokens with probability mass up to this value.</p>
                        </div>
                    </div>
                )}
              </div>
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
              {...projectContextTooltip}
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
                return <option key={p.id} value={p.id}>{optionText}</option>
              })}
            </select>
            {activeProjectId && (
                <label 
                    {...smartContextTooltip}
                    className="flex items-center gap-2 cursor-pointer" 
                >
                    <BrainCircuitIcon className={`w-5 h-5 ${isSmartContextEnabled ? 'text-[--accent-chat]' : 'text-[--text-muted]'}`} />
                    <span className="text-sm text-[--text-muted] hidden lg:inline">Smart Context</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isSmartContextEnabled} 
                            onChange={(e) => setIsSmartContextEnabled(e.target.checked)} 
                            className="sr-only peer" 
                            id="smart-context-toggle"
                        />
                        <div className="w-11 h-6 bg-[--bg-tertiary] rounded-full peer peer-checked:bg-[--accent-chat] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[--border-focus] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                    </div>
                </label>
            )}
          </div>
        )}
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
          {filteredMessages.map((msg, index) => (
              <MemoizedChatMessage
                  key={`${msg.role}-${index}`}
                  msg={msg}
                  prevMessage={filteredMessages[index-1]}
                  markdownComponents={markdownComponents}
                  onAcceptModification={onAcceptModification}
                  onRejectModification={onRejectModification}
                  theme={theme}
                  isResponding={isResponding && index === filteredMessages.length - 1}
              />
          ))}
          {thinkingText && <ThinkingIndicator content={thinkingText} />}
          <div ref={messagesEndRef} />
      </main>
      <footer className="p-4 bg-[--bg-primary] border-t border-[--border-primary] flex-shrink-0">
          <div className="relative">
              {attachedImage && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-[--bg-secondary] border border-[--border-primary] rounded-lg">
                      <img src={attachedImage} alt="Attachment preview" className="h-20 w-20 object-cover rounded" />
                      <button {...removeImgTooltip} onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5">
                          <XIcon className="w-3 h-3" />
                      </button>
                  </div>
              )}
              <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message or drop an image..."
                  className="w-full pl-24 pr-28 py-3 text-base bg-[--bg-secondary] rounded-full focus:outline-none focus:ring-2 focus:ring-[--border-focus] resize-none overflow-y-hidden"
                  rows={1}
                  disabled={isResponding}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <input type="file" ref={fileInputRef} onChange={e => handleImageChange(e.target.files ? e.target.files[0] : null)} accept="image/*" className="hidden" />
                  <button {...attachImgTooltip} onClick={() => fileInputRef.current?.click()} className="p-2 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full">
                      <PaperclipIcon className="w-5 h-5" />
                  </button>
                  <div className="relative">
                      <button 
                          ref={promptsButtonRef}
                          {...predefinedPromptsTooltip} 
                          onClick={() => setIsPromptsOpen(p => !p)} 
                          className="p-2 text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full"
                      >
                          <BookmarkIcon className="w-5 h-5" />
                      </button>
                      {isPromptsOpen && (
                          <div ref={promptsPopoverRef} className="absolute bottom-full left-0 mb-2 w-72 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                              <div className="p-2 text-xs font-semibold text-[--text-muted] border-b border-[--border-primary]">Saved Prompts</div>
                              {predefinedPrompts.length > 0 ? (
                                  predefinedPrompts.map(p => (
                                      <button 
                                          key={p.id}
                                          onClick={() => handleSelectPrompt(p.content)}
                                          title={p.content}
                                          className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] truncate"
                                      >
                                          {p.title}
                                      </button>
                                  ))
                              ) : (
                                  <p className="p-3 text-sm text-center text-[--text-muted]">No prompts saved yet. Add some in Settings.</p>
                              )}
                          </div>
                      )}
                  </div>
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isResponding ? (
                      <button {...stopGenTooltip} onClick={onStopGeneration} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600">
                          <StopIcon className="w-5 h-5" />
                      </button>
                  ) : (
                      <button {...sendMsgTooltip} onClick={handleSend} disabled={!input.trim() && !attachedImage} className="p-2 bg-[--accent-chat] text-[--user-message-text-color] rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
                          <SendIcon className="w-5 h-5" />
                      </button>
                  )}
              </div>
          </div>
      </footer>

      {isDraggingOver && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none z-30">
              <div className="text-center text-white p-8 bg-black/30 rounded-lg backdrop-blur-sm">
                  <PaperclipIcon className="w-16 h-16 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold">Drop your image here</h3>
              </div>
          </div>
      )}
    </div>
  );
}
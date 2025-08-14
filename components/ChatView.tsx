
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Theme, CodeProject, ProjectType, FileSystemEntry } from '../types';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ModelIcon from './icons/ModelIcon';
import PlayIcon from './icons/PlayIcon';
import FilePlusIcon from './icons/FilePlusIcon';
import TerminalIcon from './icons/TerminalIcon';
import { runPythonCode } from '../services/pyodideService';
import { logger } from '../services/logger';

const getProjectTypeForLang = (lang: string): ProjectType | null => {
    if (lang === 'python') return 'python';
    if (['javascript', 'js', 'nodejs'].includes(lang)) return 'nodejs';
    if (['html', 'html5'].includes(lang)) return 'webapp';
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
            const extension = lang === 'python' ? 'py' : lang === 'html' ? 'html' : 'js';
            const defaultName = extension === 'html' ? 'index' : `script-${new Date().toISOString().slice(0,10)}`;
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
                const files = await window.electronAPI!.readProjectDir(project.path);
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
        const finalPath = `${project.path}/${filename.trim()}`;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Save Code to Project</h2>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="project-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Project</label>
                        <select
                            id="project-select"
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="" disabled>-- Select a project --</option>
                            {relevantProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="filename-input" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Filename</label>
                        <input
                            id="filename-input"
                            type="text"
                            value={filename}
                            onChange={e => setFilename(e.target.value)}
                            className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter new filename or select existing"
                        />
                    </div>
                     {selectedProjectId && !isLoadingFiles && existingFiles.length > 0 && (
                         <div>
                            <label htmlFor="file-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Or overwrite existing file</label>
                             <select
                                id="file-select"
                                onChange={handleFileSelect}
                                className="w-full px-3 py-2 text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- Choose a file to overwrite --</option>
                                {existingFiles.map(f => <option key={f.path} value={f.name}>{f.name}</option>)}
                            </select>
                         </div>
                     )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || !selectedProjectId || !filename.trim()} className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800">
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
        executionEnv = isPython ? (isElectron ? 'standalone Python' : 'Pyodide (WASM)') : 'standalone Node.js';
    } else {
        executionEnv = `project: ${project?.name}`;
    }
    
    logger.info(`Running ${lang} code via ${executionEnv}`);
    logger.debug(`Code:\n---\n${codeText}\n---`);

    try {
        if (isElectron && window.electronAPI) {
            let result: { stdout: string; stderr: string };
            if (isStandalone) {
                 if(isPython) {
                    result = await window.electronAPI.runPython(codeText);
                 } else { // isNode
                    result = await window.electronAPI.runNodejs(codeText);
                 }
            } else {
                result = await window.electronAPI.runScriptInProject({ project: project!, code: codeText });
            }
            setRunState({ isLoading: false, output: result.stdout, error: result.stderr || null });
            logger.info(`Native execution stdout:\n${result.stdout}`);
            if(result.stderr) logger.warn(`Native execution stderr:\n${result.stderr}`);
        } else if (isPython) { // Pyodide fallback for Python in browser
          const { result, error } = await runPythonCode(codeText);
          setRunState({ isLoading: false, output: result, error });
          logger.info(`Pyodide output:\n${result}`);
          if(error) logger.warn(`Pyodide error:\n${error}`);
        }
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setRunState({ isLoading: false, output: null, error: errorMsg });
        logger.error(`Failed to run code: ${errorMsg}`);
    }
  };
  
  const RunIcon = (isPython || isNode) && isElectron ? TerminalIcon : PlayIcon;
  const runButtonText = runState.isLoading ? 'Running...' : 'Run';
  const canRunCode = isPython || (isNode && isElectron);

  return !inline && match ? (
    <div className="relative bg-gray-100 dark:bg-gray-800 my-2 rounded-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-1 bg-gray-200/50 dark:bg-gray-700/50 rounded-t-md text-xs">
        <span className="font-sans text-gray-500 dark:text-gray-400">{match[1]}</span>
        <div className="flex items-center gap-2">
            {(canRunCode || canRunOrSaveNative) && (
              <div className="flex items-center divide-x divide-gray-300 dark:divide-gray-600">
                <div className="flex items-center gap-1 pr-2">
                    {isElectron && (isPython || isNode) && relevantProjects.length > 0 && (
                        <select 
                            value={selectedProjectId} 
                            onChange={e => setSelectedProjectId(e.target.value)}
                            className="text-xs bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:border-blue-500"
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
                            className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-500"
                            title="Run code"
                        >
                            <RunIcon className="w-3 h-3"/>
                            {runButtonText}
                        </button>
                    )}
                </div>
                <div className="pl-2 flex items-center gap-2">
                    {canRunOrSaveNative && relevantProjects.length > 0 && (
                         <button onClick={() => onSaveRequest(codeText, lang)} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded" title="Save to Project">
                            <FilePlusIcon className="w-3.5 h-3.5" />
                            Save
                        </button>
                    )}
                    <button 
                      onClick={handleCopy}
                      className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded"
                    >
                      {isCopied ? 'Copied!' : 'Copy code'}
                    </button>
                </div>
              </div>
            )}
            {!(canRunCode || canRunOrSaveNative) && (
                <button 
                  onClick={handleCopy}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded"
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
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 font-mono text-xs bg-gray-100 dark:bg-gray-900/50 rounded-b-md">
           <h4 className="text-gray-500 dark:text-gray-400 font-sans font-semibold text-sm mb-2">Output</h4>
           {runState.output && (
             <pre className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{runState.output}</pre>
           )}
           {runState.error && (
             <pre className="whitespace-pre-wrap text-red-600 dark:text-red-400">{runState.error}</pre>
           )}
        </div>
      )}
    </div>
  ) : (
    <code className="px-1.5 py-1 bg-blue-100 dark:bg-gray-700 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
      {children}
    </code>
  );
};

interface ChatViewProps {
  modelId: string;
  onSendMessage: (userInput: string) => void;
  messages: ChatMessage[];
  isResponding: boolean;
  onBack: () => void;
  theme: Theme;
  isElectron: boolean;
  projects: CodeProject[];
  prefilledInput: string;
  onPrefillConsumed: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({ modelId, onSendMessage, messages, isResponding, onBack, theme, isElectron, projects, prefilledInput, onPrefillConsumed }) => {
  const [input, setInput] = useState('');
  const [saveModalState, setSaveModalState] = useState<{ code: string; lang: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (prefilledInput) {
      setInput(prefilledInput);
      onPrefillConsumed();
    }
  }, [prefilledInput, onPrefillConsumed]);

  const handleSend = () => {
    if (input.trim() && !isResponding) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleSaveRequest = (code: string, lang: string) => {
    setSaveModalState({ code, lang });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
     {saveModalState && isElectron && (
        <SaveToProjectModal 
            {...saveModalState}
            projects={projects}
            onClose={() => setSaveModalState(null)}
        />
     )}
      <header className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
         <div className="flex items-center gap-3">
            <ModelIcon className="w-6 h-6 text-blue-500 dark:text-blue-400"/>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{modelId}</h2>
         </div>
        <button
          onClick={onBack}
          className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none"
        >
          &larr; Change Model
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center"><ModelIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" /></div>}
            <div
              className={`max-w-2xl p-4 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && isResponding
                ? <SpinnerIcon className="w-5 h-5 text-gray-400"/>
                : <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                          code: (props) => (
                              <CodeBlock {...props} theme={theme} isElectron={isElectron} projects={projects} onSaveRequest={handleSaveRequest} />
                          ),
                          // This fixes blurred text in code blocks by removing the outer <pre>
                          // that react-markdown wraps around the custom component.
                          pre: ({ children }) => <>{children}</>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
              }
            </div>
             {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-900 dark:text-gray-200">U</div>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>
      <footer className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            disabled={isResponding}
            className="w-full pl-4 pr-12 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isResponding || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatView;
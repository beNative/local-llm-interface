
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Theme, CodeProject, ProjectType } from '../types';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ModelIcon from './icons/ModelIcon';
import PlayIcon from './icons/PlayIcon';
import TerminalIcon from './icons/TerminalIcon';
import { runPythonCode } from '../services/pyodideService';
import { logger } from '../services/logger';

interface ChatViewProps {
  modelId: string;
  onSendMessage: (message: string) => Promise<void>;
  messages: ChatMessage[];
  isResponding: boolean;
  onBack: () => void;
  theme: Theme;
  isElectron: boolean;
  projects: CodeProject[];
}

const CodeBlock = ({ node, inline, className, children, theme, isElectron, projects }: any) => {
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
  
  const codeText = String(children).replace(/\n$/, '');
  const syntaxTheme = theme === 'dark' ? atomDark : coy;
  
  const canRunNative = (isPython || isNode) && isElectron;
  const relevantProjects = projects.filter(p => p.type === (isPython ? 'python' : 'nodejs'));

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
            let result: { stdout: string, stderr: string };
            if (isStandalone) {
                 if(isPython) {
                    result = await window.electronAPI.runPython(codeText);
                 } else { // isNode
                    result = { stdout: '', stderr: 'Standalone Node.js execution is not supported. Please run in a project.'};
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
  
  const RunIcon = canRunNative ? TerminalIcon : PlayIcon;
  const runButtonText = runState.isLoading ? 'Running...' : 'Run';

  return !inline && match ? (
    <div className="relative bg-gray-100 dark:bg-gray-800 my-2 rounded-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-1 bg-gray-200/50 dark:bg-gray-700/50 rounded-t-md text-xs">
        <span className="font-sans text-gray-500 dark:text-gray-400">{match[1]}</span>
        <div className="flex items-center gap-2">
            {(isPython || (isNode && isElectron)) && (
              <div className="flex items-center gap-1">
                {canRunNative && relevantProjects.length > 0 && (
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
                <button
                    onClick={handleRun}
                    disabled={runState.isLoading || (isNode && isElectron && selectedProjectId === 'standalone')}
                    className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-500"
                    title={isNode && isElectron && selectedProjectId === 'standalone' ? 'Please select a project to run Node.js code' : ''}
                >
                    <RunIcon className="w-3 h-3"/>
                    {runButtonText}
                </button>
              </div>
            )}
            <button 
              onClick={handleCopy}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded"
            >
              {isCopied ? 'Copied!' : 'Copy code'}
            </button>
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
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 font-mono text-xs">
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
    <code className="px-1.5 py-1 bg-blue-100 dark:bg-gray-600/50 text-blue-800 dark:text-blue-300 rounded-md text-sm font-mono">
      {children}
    </code>
  );
};


const ChatView: React.FC<ChatViewProps> = ({ modelId, onSendMessage, messages, isResponding, onBack, theme, isElectron, projects }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
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
                  ? 'bg-blue-500 dark:bg-blue-700 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-bl-none'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && isResponding
                ? <SpinnerIcon className="w-5 h-5 text-gray-400"/>
                : <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{ code: (props) => <CodeBlock {...props} theme={theme} isElectron={isElectron} projects={projects} /> }}
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

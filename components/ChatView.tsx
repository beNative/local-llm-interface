import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, Theme, CodeProject, ProjectType, FileSystemEntry, ChatSession, Model, ChatMessageContentPart, PredefinedPrompt, ChatMessageMetadata, SystemPrompt, GenerationConfig, LLMProviderConfig, AssistantToolCallMessage, ToolResponseMessage, StandardChatMessage } from '../types';
import SendIcon from './icons/SendIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import ModelIcon from './icons/ModelIcon';
import CodeIcon from './icons/CodeIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { logger } from '../services/logger';
import StopIcon from './icons/StopIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import XIcon from './icons/XIcon';
import BookmarkIcon from './icons/BookmarkIcon';
import IdentityIcon from './icons/IdentityIcon';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import BrainCircuitIcon from './icons/BrainCircuitIcon';
import FileCodeIcon from './icons/FileCodeIcon';
import SlidersIcon from './icons/SlidersIcon';
import ProviderIcon from './ProviderIcon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';
import ToolCallDisplay from './ToolCallDisplay';
import PlayIcon from './icons/PlayIcon';
import GlobeIcon from './icons/GlobeIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';

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

interface CodeBlockProps {
    language: string;
    code: string;
    theme: Theme;
    onRunCode: (language: string, code: string) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, theme, onRunCode }) => {
    const [isCopied, setIsCopied] = React.useState(false);
    const syntaxTheme = theme === 'dark' ? atomDark : coy;

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleRun = () => {
        onRunCode(language, code);
    };

    const canRun = ['python', 'javascript', 'html'].includes(language);
    const runText = language === 'html' ? 'Open in Browser' : 'Run Code';
    const RunIconComponent = language === 'html' ? GlobeIcon : PlayIcon;
    
    const copyTooltip = useTooltipTrigger(isCopied ? 'Copied!' : 'Copy code');
    const runTooltip = useTooltipTrigger(runText);

    return (
        <div className="my-2 bg-[--code-bg] rounded-lg border border-[--border-primary] text-sm overflow-hidden not-prose">
            <div className="flex justify-between items-center px-4 py-1.5 bg-[--bg-tertiary] border-b border-[--border-primary]">
                <span className="font-mono text-xs text-[--text-muted]">{language}</span>
                <div className="flex items-center gap-2">
                    {canRun && (
                        <button {...runTooltip} onClick={handleRun} className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] transition-colors">
                            <RunIconComponent className="w-4 h-4" />
                            <span>{runText}</span>
                        </button>
                    )}
                    <button {...copyTooltip} onClick={handleCopy} className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] transition-colors">
                        {isCopied ? <CheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardIcon className="w-4 h-4" />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                </div>
            </div>
            <SyntaxHighlighter
                style={syntaxTheme}
                language={language}
                PreTag="div"
                customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};

const MemoizedChatMessage = React.memo<{
  msg: ChatMessage;
  markdownComponents: ReturnType<typeof useMemo>;
  theme: Theme;
  isResponding: boolean;
}>(({ msg, markdownComponents, theme, isResponding }) => {
  if (msg.role === 'tool') {
    // Tool responses are handled within the ToolCallDisplay of the preceding assistant message
    return null;
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
        className={`p-4 rounded-2xl shadow-sm max-w-full overflow-hidden ${
          msg.role === 'user'
            ? 'rounded-br-lg'
            : 'rounded-bl-lg'
        }`}
      >
        {msg.role === 'assistant' ? (
          (msg.content === '' && isResponding && !('tool_calls' in msg && msg.tool_calls)) ? (
            <SpinnerIcon className="w-5 h-5 text-gray-400"/>
          ) : (
            <>
              {msg.metadata?.thinking && <ThinkingLog content={msg.metadata.thinking} />}
              {msg.metadata?.ragContext && <ContextSources files={msg.metadata.ragContext.files} />}
              {msg.content && (
                  <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2 prose-pre:bg-transparent prose-pre:p-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {msg.content as string}
                    </ReactMarkdown>
                  </div>
              )}
              {('tool_calls' in msg && msg.tool_calls) && (
                <ToolCallDisplay 
                    message={msg as AssistantToolCallMessage} 
                    theme={theme}
                />
              )}
              {msg.metadata && <MessageMetadata metadata={msg.metadata} />}
            </>
          )
        ) : ( 
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
  models: Model[];
  onSelectModel: (modelId: string) => void;
  predefinedPrompts: PredefinedPrompt[];
  systemPrompts: SystemPrompt[];
  onSetSessionSystemPrompt: (systemPromptId: string | null) => void;
  onSetSessionGenerationConfig: (generationConfig: GenerationConfig) => void;
  onSetSessionAgentToolsEnabled: (enabled: boolean) => void;
  onRunCodeSnippet: (language: string, code: string) => void;
}

export default function ChatView({ session, provider, onSendMessage, isResponding, retrievalStatus, thinkingText, onStopGeneration, onRenameSession, theme, isElectron, projects, predefinedInput, onPrefillConsumed, models, onSelectModel, predefinedPrompts, systemPrompts, onSetSessionSystemPrompt, onSetSessionGenerationConfig, onSetSessionAgentToolsEnabled, onRunCodeSnippet }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.name);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const personaSelectorRef = useRef<HTMLDivElement>(null);
  const paramsSelectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptsPopoverRef = useRef<HTMLDivElement>(null);
  const promptsButtonRef = useRef<HTMLButtonElement>(null);

  const { messages, name: sessionName, projectId, agentToolsEnabled } = session;
  
  const currentProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const currentSystemPrompt = systemPrompts.find(p => p.id === session.systemPromptId);
  const currentPersonaName = currentSystemPrompt ? currentSystemPrompt.title : 'Default Assistant';
  const currentPersonaContent = currentSystemPrompt ? currentSystemPrompt.content : DEFAULT_SYSTEM_PROMPT;
  
  const titleTooltip = useTooltipTrigger("Click to rename");
  const modelTooltip = useTooltipTrigger("Start new chat with a different model");
  const personaTooltip = useTooltipTrigger(currentPersonaContent);
  const paramsTooltip = useTooltipTrigger("Adjust model parameters");
  const projectContextTooltip = useTooltipTrigger(`This chat has context of the project: ${currentProject?.name}.`);
  const agentToolsTooltip = useTooltipTrigger("Enable Project Agent: Allows the AI to read/write files and run commands in your project to answer questions and perform tasks.");
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
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isResponding]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
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
  
  const handleImageChange = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachedImage(reader.result as string);
        };
        // FIX: Corrected typo from readDataURL to readAsDataURL.
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
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      
      return !inline && match ? (
          <CodeBlock 
            language={match[1]}
            code={codeString}
            theme={theme}
            onRunCode={onRunCodeSnippet}
          />
      ) : (
        <code className="bg-[--bg-tertiary] text-[--text-secondary] px-1.5 py-1 rounded font-mono text-sm" {...props}>
          {children}
        </code>
      );
    }
  }), [theme, onRunCodeSnippet]);

  const filteredMessages = useMemo(() => messages.filter(m => m.role !== 'system'), [messages]);

  return (
    <div 
        className="relative flex flex-col h-full bg-[--bg-primary]"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <header className="flex items-center justify-between p-[var(--space-4)] bg-[--bg-primary] border-b border-[--border-primary] gap-[var(--space-4)]">
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
        {isElectron && (
            <div className="flex items-center gap-4">
                {currentProject && (
                    <div {...projectContextTooltip} className="flex items-center gap-2 text-sm text-[--text-muted] bg-[--bg-tertiary] px-3 py-1.5 rounded-lg border border-[--border-primary]">
                        <CodeIcon className="w-5 h-5"/>
                        <span className="font-semibold text-[--text-secondary]">{currentProject.name}</span>
                    </div>
                )}
                {currentProject && (
                    <label 
                        {...agentToolsTooltip}
                        className="flex items-center gap-2 cursor-pointer" 
                    >
                        <BrainCircuitIcon className={`w-5 h-5 ${agentToolsEnabled ? 'text-[--accent-chat]' : 'text-[--text-muted]'}`} />
                        <span className="text-sm text-[--text-muted] hidden lg:inline">Enable Project Agent</span>
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={!!agentToolsEnabled} 
                                onChange={(e) => onSetSessionAgentToolsEnabled(e.target.checked)} 
                                className="sr-only peer" 
                                id="agent-tools-toggle"
                            />
                            <div className="w-11 h-6 bg-[--bg-tertiary] rounded-full peer peer-checked:bg-[--accent-chat] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[--border-focus] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </div>
                    </label>
                )}
            </div>
        )}
      </header>
      <main className="flex-1 overflow-y-auto p-[var(--space-4)] space-y-[var(--space-6)]">
          {filteredMessages.map((msg, index) => {
              const isLastMessage = index === filteredMessages.length - 1;
              if (isLastMessage && isResponding && msg.role === 'assistant') {
                  return (
                      <React.Fragment key="responding-assistant-fragment">
                          {thinkingText && <ThinkingIndicator content={thinkingText} />}
                          {(msg.content || !thinkingText || ('tool_calls' in msg && msg.tool_calls)) &&
                              <MemoizedChatMessage
                                  key={`${msg.role}-${index}`}
                                  msg={msg}
                                  markdownComponents={markdownComponents}
                                  theme={theme}
                                  isResponding={true}
                              />
                          }
                      </React.Fragment>
                  );
              }
              return (
                  <MemoizedChatMessage
                      key={`${msg.role}-${index}`}
                      msg={msg}
                      markdownComponents={markdownComponents}
                      theme={theme}
                      isResponding={false}
                  />
              );
          })}
          {retrievalStatus === 'retrieving' && <ThinkingIndicator content="Analyzing project to find relevant context..." />}
          <div ref={messagesEndRef} />
      </main>
      <footer className="p-[var(--space-4)] bg-[--bg-primary] border-t border-[--border-primary] flex-shrink-0">
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
                  className="w-full pl-24 pr-28 py-[var(--space-3)] text-[length:var(--font-size-base)] bg-[--bg-secondary] rounded-full focus:outline-none focus:ring-2 focus:ring-[--border-focus] resize-none overflow-y-hidden"
                  rows={1}
                  disabled={isResponding}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <input type="file" ref={fileInputRef} onChange={e => handleImageChange(e.target.files ? e.target.files[0] : null)} accept="image/*" className="hidden" />
                  <button {...attachImgTooltip} onClick={() => fileInputRef.current?.click()} className="p-[var(--space-2)] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full">
                      <PaperclipIcon className="w-5 h-5" />
                  </button>
                  <div className="relative">
                      <button 
                          ref={promptsButtonRef}
                          {...predefinedPromptsTooltip} 
                          onClick={() => setIsPromptsOpen(p => !p)} 
                          className="p-[var(--space-2)] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-hover] rounded-full"
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

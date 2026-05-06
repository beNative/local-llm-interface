
import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
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
import Icon from './Icon';

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
                        return <ContextSourceFile key={index} path={files[index]} name={name ?? files[index]} />;
                    })}
                </div>
            )}
        </div>
    );
};

const ContextSourceFile: React.FC<{ path: string; name: string }> = ({ path, name }) => {
    const tooltipProps = useTooltipTrigger(path);
    return <div {...tooltipProps} className="truncate">{name}</div>;
};

const PredefinedPromptButton: React.FC<{ prompt: PredefinedPrompt; onSelect: (content: string) => void; }> = ({ prompt, onSelect }) => {
    const tooltipProps = useTooltipTrigger(prompt.content);
    return (
        <button
            {...tooltipProps}
            onClick={() => onSelect(prompt.content)}
            className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary] truncate"
        >
            {prompt.title}
        </button>
    );
};

const MessageMetadata: React.FC<{ metadata: ChatMessageMetadata }> = ({ metadata }) => {
    const { usage, speed, duration, ttft } = metadata;
    if (!usage && speed === undefined && duration === undefined) return null;

    const speedTooltip = useTooltipTrigger("Generation Speed: Average tokens generated per second during the generation phase.");
    const tokenTooltip = useTooltipTrigger(`Token Usage: ${usage?.total_tokens || usage?.completion_tokens || 0} total (Prompt: ${usage?.prompt_tokens || 0}, Completion: ${usage?.completion_tokens || 0})`);
    const durationTooltip = useTooltipTrigger(`Timing: Total ${duration?.toFixed(2)}s${ttft !== undefined ? ` | Time to First Token (TTFT): ${ttft.toFixed(2)}s` : ''}`);

    return (
        <div className="mt-4 pt-3 border-t border-[--assistant-message-text-color]/5 flex items-center flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
             <Icon name="lightbulb" className="w-3.5 h-3.5 text-[--text-muted] opacity-50 mr-1" />
             
             {speed !== undefined && (
                <div {...speedTooltip} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--bg-tertiary]/40 border border-[--border-primary]/30 text-[10px] font-bold uppercase tracking-wider text-[--text-muted] hover:bg-[--bg-tertiary]/60 transition-colors cursor-help">
                    <Icon name="zap" className="w-3 h-3 text-yellow-500/80" />
                    <span>{speed.toFixed(2)} tok/sec</span>
                </div>
            )}
            
            {usage?.completion_tokens !== undefined && (
                <div {...tokenTooltip} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--bg-tertiary]/40 border border-[--border-primary]/30 text-[10px] font-bold uppercase tracking-wider text-[--text-muted] hover:bg-[--bg-tertiary]/60 transition-colors cursor-help">
                    <Icon name="fileText" className="w-3 h-3 text-blue-500/80" />
                    <span>{usage.completion_tokens} tokens</span>
                </div>
            )}
            
            {duration !== undefined && (
                <div {...durationTooltip} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[--bg-tertiary]/40 border border-[--border-primary]/30 text-[10px] font-bold uppercase tracking-wider text-[--text-muted] hover:bg-[--bg-tertiary]/60 transition-colors cursor-help">
                    <Icon name="clock" className="w-3 h-3 text-green-500/80" />
                    <span>{duration.toFixed(2)}s</span>
                </div>
            )}
        </div>
    );
};

const CopyButton: React.FC<{ content: string; className?: string }> = ({ content, className }) => {
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const copyTooltip = useTooltipTrigger(isCopied ? "Copied!" : "Copy to clipboard");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            {...copyTooltip}
            className={`p-1.5 rounded-lg bg-[--bg-secondary]/80 hover:bg-[--bg-hover] text-[--text-muted] hover:text-[--text-primary] transition-all border border-[--border-primary]/30 shadow-sm ${className}`}
        >
            <Icon name={isCopied ? 'check' : 'clipboard'} className={`w-3.5 h-3.5 ${isCopied ? 'text-green-500' : ''}`} />
        </button>
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
    const isHtml = language === 'html';

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleRun = () => {
        logger.info(`Code block action clicked: ${language} (${code.length} chars).`);
        onRunCode(language, code);
    };

    const canRun = ['python', 'javascript', 'html'].includes(language);
    const runText = language === 'html' ? 'Open in Browser' : 'Run Code';
    const RunIconComponent = language === 'html' ? GlobeIcon : PlayIcon;
    
    const copyTooltip = useTooltipTrigger(isCopied ? 'Copied!' : 'Copy code');
    const runTooltip = useTooltipTrigger(runText);

    return (
        <div className="my-2 bg-[--code-bg] rounded-lg border border-[--border-primary] text-sm overflow-hidden not-prose">
            <div className="flex justify-between items-center gap-3 px-4 py-1.5 bg-[--bg-tertiary] border-b border-[--border-primary]">
                <span className="font-mono text-xs text-[--text-muted]">{language}</span>
                <div className="flex items-center gap-2">
                    {canRun && (
                        <button
                            type="button"
                            {...runTooltip}
                            onMouseDown={isHtml ? (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                logger.info(`Code block run button pressed: ${language} (${code.length} chars).`);
                                handleRun();
                            } : undefined}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isHtml) {
                                    logger.info(`Code block run button pressed: ${language} (${code.length} chars).`);
                                    handleRun();
                                }
                            }}
                            className={
                                isHtml
                                    ? 'inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-300 border border-amber-500/40 hover:border-amber-400/60 shadow-sm cursor-pointer transition-colors'
                                    : 'flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] transition-colors'
                            }
                        >
                            <RunIconComponent className="w-4 h-4" />
                            <span>{runText}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        {...copyTooltip}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            logger.info(`Code block copy button pressed: ${language} (${code.length} chars).`);
                            handleCopy();
                        }}
                        className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] transition-colors"
                    >
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
  streamingDraft: string | null;
  onRunCodeSnippet: (language: string, code: string) => void;
}>(({ msg, markdownComponents, theme, isResponding, streamingDraft, onRunCodeSnippet }) => {
  if (msg.role === 'tool') {
    // Tool responses are handled within the ToolCallDisplay of the preceding assistant message
    return null;
  }

  const isStreamingPlaceholder =
      msg.role === 'assistant' &&
      typeof msg.content === 'string' &&
      msg.content.length === 0 &&
      isResponding &&
      !('tool_calls' in msg && msg.tool_calls);

  const effectiveContent =
      isStreamingPlaceholder && streamingDraft !== null ? streamingDraft : msg.content;

  const copyText = useMemo(() => {
    if (typeof effectiveContent === 'string') return effectiveContent;
    if (Array.isArray(effectiveContent)) {
        return effectiveContent.filter(p => p.type === 'text').map(p => (p as any).text).join('\n');
    }
    return '';
  }, [effectiveContent]);

  return (
    <div
      className={`flex items-start gap-4 group ${msg.role === 'user' ? 'justify-end' : ''}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 220px' } as React.CSSProperties}
    >
      {msg.role === 'assistant' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center"><ModelIcon className="w-5 h-5 text-[--accent-chat]" /></div>}
      <div
        style={{
          backgroundColor: msg.role === 'user' ? 'var(--user-message-bg-color)' : 'var(--assistant-message-bg-color)',
          color: msg.role === 'user' ? 'var(--user-message-text-color)' : 'var(--assistant-message-text-color)',
          backgroundImage: msg.role === 'user' ? 'var(--user-message-bg-image)' : 'none',
        }}
        className={`relative p-4 rounded-xl shadow-sm max-w-full overflow-hidden border ${msg.role === 'user' ? 'border-transparent' : 'border-[--border-primary]'}`}
      >
        {msg.role === 'assistant' ? (
          (isStreamingPlaceholder && !effectiveContent) ? (
            <SpinnerIcon className="w-5 h-5 text-gray-400"/>
          ) : (
            <>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <CopyButton content={copyText} />
              </div>
              {msg.metadata?.ragContext && <ContextSources files={msg.metadata.ragContext.files} />}
              {effectiveContent && (
                <div
                    className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-table:my-2 prose-blockquote:my-2 prose-pre:bg-transparent prose-pre:p-0"
                    style={{ fontSize: 'var(--chat-font-size)' }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {effectiveContent as string}
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
          <>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <CopyButton content={copyText} />
            </div>
            <div
              className="space-y-2"
              style={{ fontSize: 'var(--chat-font-size)' }}
            >
            {Array.isArray(msg.content) ? (
              msg.content.map((part, i) => {
                if (part.type === 'image_url') {
                  return <img key={i} src={part.image_url.url} className="max-w-xs rounded-none" alt="User upload" />;
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
        </>
      )}
      </div>
       {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center font-bold text-[--text-primary]">U</div>}
    </div>
    );
});

interface ChatTranscriptProps {
  messages: ChatMessage[];
  theme: Theme;
  isResponding: boolean;
  streamingDraft: string | null;
  retrievalStatus: 'idle' | 'retrieving';
  markdownComponents: ReturnType<typeof useMemo>;
  onRunCodeSnippet: (language: string, code: string) => void;
}

const ChatTranscript = React.memo<ChatTranscriptProps>(({
  messages,
  theme,
  isResponding,
  streamingDraft,
  retrievalStatus,
  markdownComponents,
  onRunCodeSnippet,
}) => {
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const isNearBottomRef = useRef(true);

  const updateNearBottomState = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  }, []);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateNearBottomState();
    };

    updateNearBottomState();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [updateNearBottomState]);

  useLayoutEffect(() => {
    const container = chatScrollRef.current;
    if (!container || !isNearBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
  }, [messages.length, streamingDraft, retrievalStatus]);

  return (
    <main ref={chatScrollRef} className="flex-1 overflow-y-auto p-[var(--space-4)] space-y-[var(--space-6)]">
      {messages.filter(m => m.role !== 'system').map((msg, index, arr) => {
          const isLastMessage = index === arr.length - 1;
          return (
              <MemoizedChatMessage
                  key={`${msg.role}-${index}`}
                  msg={msg}
                  markdownComponents={markdownComponents}
                  theme={theme}
                  isResponding={isLastMessage && isResponding}
                  streamingDraft={isLastMessage ? streamingDraft : null}
                  onRunCodeSnippet={onRunCodeSnippet}
              />
          );
      })}
      {retrievalStatus === 'retrieving' && (
          <div className="flex items-start gap-4">
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[--bg-tertiary] flex items-center justify-center">
                  <BrainCircuitIcon className="w-5 h-5 text-[--accent-chat] animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl rounded-bl-lg shadow-sm w-full bg-[--assistant-message-bg-color] border border-[--border-primary]">
                  <h4 className="font-semibold text-sm text-[--assistant-message-text-color]/80 flex items-center gap-2">
                      <SpinnerIcon className="w-4 h-4" />
                      Analyzing project to find relevant context...
                  </h4>
              </div>
          </div>
      )}
    </main>
  );
});

interface ChatViewProps {
  session: ChatSession;
  provider: LLMProviderConfig | null;
  onSendMessage: (content: string | ChatMessageContentPart[], options?: { useRAG: boolean }) => void;
  isResponding: boolean;
  streamingDraft: string | null;
  retrievalStatus: 'idle' | 'retrieving';
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
  onRegisterInputFocusHandler?: (handler: (() => void) | null) => void;
}

const PersonaSelectorItem: React.FC<{
  prompt: SystemPrompt;
  onSelect: (id: string) => void;
}> = ({ prompt, onSelect }) => {
  const promptTooltip = useTooltipTrigger(prompt.content);

  return (
    <button
      {...promptTooltip}
      onClick={() => onSelect(prompt.id)}
      className="w-full text-left block px-3 py-1.5 text-sm text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]"
    >
      {prompt.title}
    </button>
  );
};

export default function ChatView({ session, provider, onSendMessage, isResponding, streamingDraft, retrievalStatus, onStopGeneration, onRenameSession, theme, isElectron, projects, predefinedInput, onPrefillConsumed, models, onSelectModel, predefinedPrompts, systemPrompts, onSetSessionSystemPrompt, onSetSessionGenerationConfig, onSetSessionAgentToolsEnabled, onRunCodeSnippet, onRegisterInputFocusHandler }: ChatViewProps) {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(session.name);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isPromptsOpen, setIsPromptsOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const personaSelectorRef = useRef<HTMLDivElement>(null);
  const paramsSelectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptsPopoverRef = useRef<HTMLDivElement>(null);
  const promptsButtonRef = useRef<HTMLButtonElement>(null);

  const { messages, name: sessionName, projectId, agentToolsEnabled } = session;

  const currentModel = useMemo(() => models.find(m => m.id === session.modelId), [models, session.modelId]);

  const hasVision = useMemo(() => {
    if (!currentModel) return false;
    const id = currentModel.id.toLowerCase();
    const family = currentModel.details?.family?.toLowerCase() || '';
    return id.includes('vision') || id.includes('llava') || id.includes('moondream') || id.includes('gemini') || family.includes('vision');
  }, [currentModel]);

  const hasTools = useMemo(() => {
    if (!currentModel) return false;
    const id = currentModel.id.toLowerCase();
    return id.includes('gemini') || id.includes('gpt-') || id.includes('claude') || id.includes('llama-3') || id.includes('mistral') || id.includes('qwen');
  }, [currentModel]);

  const contextStats = useMemo(() => {
    const lastMessageWithUsage = [...messages].reverse().find(m => m.metadata?.usage);
    const historyUsed = lastMessageWithUsage?.metadata?.usage?.total_tokens || 0;
    
    // Add estimate for the current input being typed
    const inputEstimate = Math.ceil(input.length / 3.5);
    const used = historyUsed + inputEstimate;

    const max = currentModel?.details?.context_length || 32768;
    const percent = Math.min(100, Math.round((used / max) * 100));
    return { used, max, percent };
  }, [messages, currentModel, input]);

  const contextTooltip = useTooltipTrigger(`Context Usage: ${contextStats.used} / ${contextStats.max} tokens (${contextStats.percent}%)`);
  const visionTooltip = useTooltipTrigger("This model supports image analysis (Vision)");
  const toolsTooltip = useTooltipTrigger("This model supports native tool use (Function Calling)");
  
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
    if (!onRegisterInputFocusHandler) return;
    const handler = () => textareaRef.current?.focus();
    onRegisterInputFocusHandler(handler);
    return () => {
      onRegisterInputFocusHandler(null);
    };
  }, [onRegisterInputFocusHandler]);

// FIX: This hook resets component state when switching sessions.
// This prevents carrying over state like input text or attachments between different conversations.
  useEffect(() => {
    setInput('');
    setAttachedImage(null);
    setIsEditingTitle(false);
    setIsModelSelectorOpen(false);
    setIsPersonaSelectorOpen(false);
    setIsParamsOpen(false);
    setIsPromptsOpen(false);
  }, [session.id]);

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
        contentParts.push({ type: 'image_url', image_url: { url: attachedImage, detail: 'auto' } });
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                handleImageChange(file);
                e.preventDefault();
            }
        }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
              handleImageChange(file);
          }
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

  return (
    <div 
        className="relative flex h-full bg-[--bg-primary] overflow-hidden"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="flex items-center justify-between px-6 py-2 bg-[--bg-sidebar] border-b border-[--border-primary] z-10">
          <div className="flex items-center gap-4 min-w-0 flex-1">
             <div className="relative flex-shrink-0" ref={modelSelectorRef}>
                <button
                    {...modelTooltip}
                    onClick={() => setIsModelSelectorOpen(prev => !prev)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] text-sm font-medium hover:border-[--border-focus] transition-all"
                >
                    <ProviderIcon provider={provider} className="w-4 h-4" />
                    <span className="truncate max-w-[200px]">{session.modelId}</span>
                    <ChevronDownIcon className={`w-4 h-4 text-[--text-muted] transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isModelSelectorOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-[--bg-secondary] border border-[--border-primary] rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-3 text-xs font-bold uppercase tracking-wider text-[--text-muted] bg-[--bg-sidebar] border-b border-[--border-primary]">Change Model</div>
                        <div className="max-h-80 overflow-y-auto">
                            {models.map(model => (
                                <button 
                                    key={model.id}
                                    onClick={() => {
                                        onSelectModel(model.id);
                                        setIsModelSelectorOpen(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-[--bg-hover] transition-colors border-b border-[--border-primary]/5 last:border-0"
                                >
                                    <div className="font-medium text-[--text-primary]">{model.id}</div>
                                    <div className="text-xs text-[--text-muted] truncate">{model.providerId}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="h-4 w-px bg-[--border-primary]" />

            {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleRename}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleRename()}
                  className="flex-1 bg-transparent border-b border-[--border-focus] focus:outline-none text-sm font-medium py-1 px-2"
                />
              ) : (
                <h2
                  {...titleTooltip}
                  className="text-sm font-medium text-[--text-secondary] truncate cursor-pointer hover:bg-[--bg-hover] px-2 py-1 rounded-md transition-colors"
                  onClick={() => setIsEditingTitle(true)}
                >
                  {session.name}
                </h2>
              )}
          </div>

          <div className="flex items-center gap-2">
            {projectId && (
                <div {...projectContextTooltip} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                    <CodeIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Project Context</span>
                </div>
            )}
            <button
                onClick={() => setIsParamsOpen(prev => !prev)}
                className={`p-2 rounded-lg transition-colors ${isParamsOpen ? 'bg-[--accent-chat] text-white' : 'text-[--text-muted] hover:bg-[--bg-hover]'}`}
                title="Toggle Configuration Sidebar"
            >
                <SlidersIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        <ChatTranscript
          messages={messages}
          theme={theme}
          isResponding={isResponding}
          streamingDraft={streamingDraft}
          retrievalStatus={retrievalStatus}
          markdownComponents={markdownComponents}
          onRunCodeSnippet={onRunCodeSnippet}
        />

        <div className="p-4 bg-[--bg-primary]">
          {isDraggingOver && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[--bg-backdrop] backdrop-blur-sm">
                <div className="flex flex-col items-center p-8 border-4 border-dashed border-[--accent-chat] rounded-3xl bg-[--bg-primary] shadow-2xl">
                    <PaperclipIcon className="w-16 h-16 text-[--accent-chat] mb-4 animate-bounce" />
                    <p className="text-xl font-bold text-[--text-primary]">Drop Image Here</p>
                    <p className="text-[--text-muted]">to analyze it with {session.modelId}</p>
                </div>
            </div>
          )}
          
          <div className="max-w-4xl mx-auto relative">
            {attachedImage && (
              <div className="absolute bottom-full left-0 mb-4 p-2 bg-[--bg-secondary] border border-[--border-primary] rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[--border-secondary]">
                    <img src={attachedImage} className="w-full h-full object-cover" alt="Attachment" />
                    <button
                        {...removeImgTooltip}
                        onClick={() => setAttachedImage(null)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                    >
                        <XIcon className="w-3 h-3" />
                    </button>
                </div>
                <div className="pr-4">
                    <p className="text-xs font-bold text-[--text-primary]">Image Ready</p>
                    <p className="text-[10px] text-[--text-muted]">Analysis enabled for this model</p>
                </div>
              </div>
            )}
            
            <div className={`relative flex flex-col border rounded-2xl transition-all duration-300 shadow-sm ${isResponding ? 'bg-[--bg-tertiary] border-transparent' : 'bg-[--bg-secondary] border-[--border-primary] focus-within:border-[--border-focus] focus-within:ring-1 focus-within:ring-[--border-focus] focus-within:shadow-md'}`}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                placeholder={isResponding ? "AI is thinking..." : "Ask anything... (Shift+Enter for newline)"}
                disabled={isResponding}
                rows={1}
                className="w-full p-4 pr-12 bg-transparent resize-none focus:outline-none text-[--text-primary] text-base min-h-[56px] max-h-[40vh]"
              />
              
              <div className="flex items-center justify-between px-3 py-2 border-t border-[--border-primary]/50">
                <div className="flex items-center gap-1.5 ml-1">
                   <button
                        {...attachImgTooltip}
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-lg text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary] transition-all"
                    >
                        <Icon name="plus" className="w-4 h-4" />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => {
                                handleImageChange(e.target.files ? e.target.files[0] : null);
                                e.target.value = ''; 
                            }}
                            className="hidden"
                            accept="image/*"
                        />
                    </button>
                    
                    {hasTools && (
                        <div {...toolsTooltip} className="p-2 text-[--text-muted] opacity-60">
                            <Icon name="hammer" className="w-4 h-4" />
                        </div>
                    )}

                    {hasVision && (
                        <div {...visionTooltip} className="flex items-center gap-1.5 px-2 py-0.5 ml-1 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-bold text-yellow-600 dark:text-yellow-500">
                            <Icon name="eye" className="w-3 h-3" />
                            <span>Vision</span>
                        </div>
                    )}
                    
                    <div className="relative ml-1">
                        <button
                            ref={promptsButtonRef}
                            {...predefinedPromptsTooltip}
                            onClick={() => setIsPromptsOpen(!isPromptsOpen)}
                            className={`p-2 rounded-lg transition-all ${isPromptsOpen ? 'bg-[--bg-hover] text-[--text-primary]' : 'text-[--text-muted] hover:bg-[--bg-hover] hover:text-[--text-primary]'}`}
                        >
                            <BookmarkIcon className="w-4 h-4" />
                        </button>
                        {isPromptsOpen && (
                            <div 
                                ref={promptsPopoverRef}
                                className="absolute bottom-full left-0 mb-2 w-64 bg-[--bg-secondary] border border-[--border-primary] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2"
                            >
                                <div className="p-3 text-xs font-bold uppercase tracking-wider text-[--text-muted] bg-[--bg-sidebar] border-b border-[--border-primary]">Prompts</div>
                                <div className="max-h-60 overflow-y-auto">
                                    {predefinedPrompts.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-[--text-muted]">No prompts saved</div>
                                    ) : (
                                        predefinedPrompts.map((p, i) => (
                                            <PredefinedPromptButton key={i} prompt={p} onSelect={handleSelectPrompt} />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div {...contextTooltip} className="flex items-center gap-2 pr-2">
                        <div className="relative w-5 h-5">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="10" cy="10" r="8"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="transparent"
                                    className="text-[--border-primary]"
                                />
                                <circle
                                    cx="10" cy="10" r="8"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="transparent"
                                    strokeDasharray={50.26}
                                    strokeDashoffset={50.26 - (50.26 * contextStats.percent) / 100}
                                    className="text-blue-500 transition-all duration-500"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                        <span className="text-[10px] font-mono text-[--text-muted] tabular-nums">{contextStats.percent}%</span>
                    </div>
                    {projectId && (
                        <div className="flex items-center gap-2 mr-2">
                             <label className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] cursor-help" {...agentToolsTooltip}>
                                Agent Mode
                            </label>
                            <button
                                onClick={() => onSetSessionAgentToolsEnabled(!agentToolsEnabled)}
                                className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${agentToolsEnabled ? 'bg-green-500' : 'bg-gray-400'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 ${agentToolsEnabled ? 'left-4.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    )}
                    {isResponding ? (
                        <button
                            {...stopGenTooltip}
                            onClick={onStopGeneration}
                            className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 px-4"
                        >
                            <StopIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Stop</span>
                        </button>
                    ) : (
                        <button
                            {...sendMsgTooltip}
                            onClick={handleSend}
                            disabled={!input.trim() && !attachedImage}
                            className={`p-2 rounded-xl transition-all flex items-center gap-2 px-4 ${(!input.trim() && !attachedImage) ? 'bg-[--bg-tertiary] text-[--text-muted] cursor-not-allowed' : 'bg-[--accent-chat] text-white hover:opacity-90 shadow-lg shadow-blue-500/20'}`}
                        >
                            <span className="text-xs font-bold uppercase tracking-wider">Send</span>
                            <SendIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar for Parameters (LM Studio Style) */}
      <aside className={`w-80 h-full bg-[--bg-sidebar]/80 backdrop-blur-md border-l border-[--border-primary] overflow-y-auto transition-all duration-300 transform ${isParamsOpen ? 'translate-x-0' : 'translate-x-full fixed right-0 opacity-0 pointer-events-none'}`}>
          <div className="p-6 space-y-8">
              <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-4">Chat Context</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-medium text-[--text-secondary] mb-2 block">System Prompt / Persona</label>
                          <div className="relative" ref={personaSelectorRef}>
                            <button
                                onClick={() => setIsPersonaSelectorOpen(prev => !prev)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] text-sm hover:border-[--border-focus] transition-all"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <IdentityIcon className="w-4 h-4 text-[--accent-chat]" />
                                    <span className="truncate">{currentPersonaName}</span>
                                </div>
                                <ChevronDownIcon className={`w-4 h-4 text-[--text-muted] transition-transform ${isPersonaSelectorOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isPersonaSelectorOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[--bg-secondary] border border-[--border-primary] rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="max-h-60 overflow-y-auto">
                                        <button 
                                            onClick={() => {
                                                onSetSessionSystemPrompt(null);
                                                setIsPersonaSelectorOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-[--bg-hover] transition-colors border-b border-[--border-primary]/5 last:border-0"
                                        >
                                            Default Assistant
                                        </button>
                                        {systemPrompts.map(prompt => (
                                            <button 
                                                key={prompt.id}
                                                onClick={() => {
                                                    onSetSessionSystemPrompt(prompt.id);
                                                    setIsPersonaSelectorOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-[--bg-hover] transition-colors border-b border-[--border-primary]/5 last:border-0"
                                            >
                                                {prompt.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                          </div>
                      </div>
                      <div className="p-3 bg-[--bg-tertiary]/50 border border-[--border-primary] rounded-lg">
                          <p className="text-[11px] leading-relaxed text-[--text-muted] italic">
                              "{currentPersonaContent.length > 150 ? currentPersonaContent.substring(0, 150) + '...' : currentPersonaContent}"
                          </p>
                      </div>
                  </div>
              </div>

              <div className="h-px bg-[--border-primary]" />

              <div>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[--text-muted]">Parameters</h3>
                      <button onClick={handleResetParams} className="text-[10px] font-bold text-[--accent-chat] uppercase tracking-wider hover:opacity-80">Reset</button>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-3">
                          <div className="flex justify-between text-xs">
                              <span className="text-[--text-secondary] font-medium">Temperature</span>
                              <span className="font-mono text-[--accent-chat]">{session.generationConfig?.temperature?.toFixed(2) ?? '0.80'}</span>
                          </div>
                          <input
                              type="range"
                              min="0" max="2" step="0.01"
                              value={session.generationConfig?.temperature ?? 0.8}
                              onChange={e => handleParamChange('temperature', e.target.value)}
                              className="w-full h-1 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer accent-[--accent-chat]"
                          />
                          <p className="text-[10px] text-[--text-muted]">Higher values make output more random, lower more deterministic.</p>
                      </div>

                      <div className="space-y-3">
                          <div className="flex justify-between text-xs">
                              <span className="text-[--text-secondary] font-medium">Top P (Nucleus)</span>
                              <span className="font-mono text-[--accent-chat]">{session.generationConfig?.topP?.toFixed(2) ?? '0.90'}</span>
                          </div>
                          <input
                              type="range"
                              min="0" max="1" step="0.01"
                              value={session.generationConfig?.topP ?? 0.9}
                              onChange={e => handleParamChange('topP', e.target.value)}
                              className="w-full h-1 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer accent-[--accent-chat]"
                          />
                      </div>

                      <div className="space-y-3">
                          <div className="flex justify-between text-xs">
                              <span className="text-[--text-secondary] font-medium">Top K</span>
                              <span className="font-mono text-[--accent-chat]">{session.generationConfig?.topK ?? '40'}</span>
                          </div>
                          <input
                              type="range"
                              min="1" max="100" step="1"
                              value={session.generationConfig?.topK ?? 40}
                              onChange={e => handleParamChange('topK', e.target.value)}
                              className="w-full h-1 bg-[--bg-tertiary] rounded-lg appearance-none cursor-pointer accent-[--accent-chat]"
                          />
                      </div>
                  </div>
              </div>
          </div>
      </aside>
    </div>
  );
}

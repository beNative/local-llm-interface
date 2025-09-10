import React, { useState, useEffect, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT } from 'diff-match-patch';
import type { AssistantToolCallMessage, Theme, ToolCall } from '../types';
import Icon from './Icon';
import { logger } from '../services/logger';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

const getIconForTool = (toolName: string) => {
    if (toolName.includes('File')) return 'fileCode';
    if (toolName.includes('Terminal')) return 'terminal';
    if (toolName.includes('Python')) return 'code';
    return 'hammer';
};

const DiffViewer: React.FC<{ oldContent: string; newContent: string; fileName: string; }> = ({ oldContent, newContent, fileName }) => {
    const [isCopied, setIsCopied] = useState(false);
    const copyTooltip = useTooltipTrigger(isCopied ? 'Copied!' : 'Copy diff');

    const diff = useMemo(() => {
        const dmp = new diff_match_patch();
        const diffResult = dmp.diff_main(oldContent, newContent);
        dmp.diff_cleanupSemantic(diffResult);
        return diffResult;
    }, [oldContent, newContent]);

    const diffTextForClipboard = useMemo(() => {
        if (!diff) return '';
        return diff.flatMap(([op, text]) => {
            const sign = op === DIFF_INSERT ? '+' : op === DIFF_DELETE ? '-' : ' ';
            const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
            return lines.map(line => `${sign} ${line}`);
        }).join('\n');
    }, [diff]);

    const handleCopy = () => {
        navigator.clipboard.writeText(diffTextForClipboard);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    let oldLine = 0;
    let newLine = 0;

    return (
        <div className="bg-[--code-bg] rounded-lg border border-[--border-primary] text-sm overflow-hidden not-prose">
            <div className="flex justify-between items-center px-4 py-1.5 bg-[--bg-tertiary] border-b border-[--border-primary]">
                <span className="font-mono text-xs text-[--text-muted] flex items-center gap-2">
                    <Icon name="fileCode" className="w-4 h-4" />
                    {fileName}
                </span>
                <button {...copyTooltip} onClick={handleCopy} className="flex items-center gap-1 text-xs text-[--text-muted] hover:text-[--text-primary] transition-colors">
                    {isCopied ? <Icon name="check" className="w-4 h-4 text-green-500" /> : <Icon name="clipboard" className="w-4 h-4" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>
            <div className="font-mono text-xs max-h-80 overflow-auto">
                {diff.map(([op, text], i) => {
                    const lines = text.split('\n');
                    return lines.map((line, lineIndex) => {
                        if (line === '' && lineIndex === lines.length - 1 && i === diff.length - 1) return null;
                        
                        if (op !== DIFF_DELETE) newLine++;
                        if (op !== DIFF_INSERT) oldLine++;

                        let bgClass = '';
                        let sign = '';
                        let signClass = '';
                        let lineNumberBgClass = 'bg-transparent';

                        if (op === DIFF_INSERT) {
                            bgClass = 'bg-green-500/10';
                            sign = '+';
                            signClass = 'text-green-500';
                            lineNumberBgClass = 'bg-green-500/10';
                        } else if (op === DIFF_DELETE) {
                            bgClass = 'bg-red-500/10';
                            sign = '-';
                            signClass = 'text-red-500';
                            lineNumberBgClass = 'bg-red-500/10';
                        } else {
                             lineNumberBgClass = 'bg-[--bg-tertiary]/30';
                        }

                        return (
                            <div key={`${i}-${lineIndex}`} className={`flex ${bgClass}`}>
                                <div className={`flex-shrink-0 flex text-right select-none text-[--text-muted] sticky left-0 ${lineNumberBgClass}`}>
                                    <span className="w-8 px-2">{op !== DIFF_INSERT ? oldLine : ''}</span>
                                    <span className="w-8 px-2">{op !== DIFF_DELETE ? newLine : ''}</span>
                                </div>
                                <span className={`w-6 text-center select-none flex-shrink-0 ${signClass}`}>{sign}</span>
                                <pre className="whitespace-pre-wrap flex-grow pr-4">{line}</pre>
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
};


const ToolCallResult: React.FC<{ call: ToolCall; theme: Theme }> = ({ call, theme }) => {
    const syntaxTheme = theme === 'dark' ? atomDark : coy;

    let resultNode: React.ReactNode;
    if (call.result === undefined) {
        if (!call.approved) {
            resultNode = <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400"><Icon name="xCircle" className="w-4 h-4" /> Denied by user.</div>;
        } else {
            resultNode = <div className="flex items-center gap-2 text-sm text-[--text-muted]"><Icon name="spinner" className="w-4 h-4" /> Executing...</div>;
        }
    } else if (call.function.name === 'writeFile' && call.result?.success) {
        const args = JSON.parse(call.function.arguments);
        const fileName = args.path.split(/[/\\]/).pop() || args.path;
        resultNode = <DiffViewer
            oldContent={call.result.originalContent || ''}
            newContent={args.content}
            fileName={fileName}
        />
    } else {
        const resultString = typeof call.result === 'string' ? call.result : JSON.stringify(call.result, null, 2);
        const language = typeof call.result === 'object' ? 'json' : 'bash';
        resultNode = (
            <div className="bg-[--code-bg] rounded-md border border-[--border-primary]">
                <SyntaxHighlighter
                    language={language}
                    style={syntaxTheme}
                    customStyle={{ margin: 0, background: 'transparent', maxHeight: '20rem' }}
                >
                    {resultString}
                </SyntaxHighlighter>
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-1">
            <h5 className="text-xs font-semibold text-[--text-muted]">Result</h5>
            {resultNode}
        </div>
    );
};

interface ToolCallDisplayProps {
    message: AssistantToolCallMessage;
    theme: Theme;
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ message, theme }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const { tool_calls } = message;
    const isFinished = tool_calls.every(c => c.result !== undefined);
    const title = isFinished ? `Used ${tool_calls.length} tool(s)` : `Using ${tool_calls.length} tool(s)...`;
    const expandTooltip = useTooltipTrigger(isExpanded ? "Collapse" : "Expand");

    return (
        <div className="w-full bg-[--bg-primary] border border-[--border-primary] rounded-[--border-radius] shadow-sm my-2 text-sm">
            <header className="p-3 border-b border-[--border-primary] flex justify-between items-center">
                <div className="flex items-center gap-2 font-semibold text-[--text-primary]">
                    {isFinished ? <Icon name="check" className="w-5 h-5 text-green-500" /> : <Icon name="spinner" className="w-5 h-5 text-[--text-muted]" />}
                    <span>{title}</span>
                </div>
                <button {...expandTooltip} onClick={() => setIsExpanded(p => !p)} className="p-1 rounded-full hover:bg-[--bg-hover]"><Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-5 h-5" /></button>
            </header>
            {isExpanded && (
                 <main className="p-3 space-y-3">
                    {tool_calls.map(call => (
                        <div key={call.id} className="p-3 bg-[--bg-secondary] rounded-lg border border-[--border-secondary]">
                            <div className="flex items-center gap-2 font-semibold text-sm text-[--text-secondary]">
                               <Icon name={getIconForTool(call.function.name)} className="w-4 h-4"/>
                               <span>{call.function.name}</span>
                            </div>
                            <div className="mt-1 pl-6">
                                <SyntaxHighlighter language="json" style={theme === 'dark' ? atomDark : coy} customStyle={{ margin: 0, padding: '0.5rem', background: 'transparent', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {JSON.stringify(JSON.parse(call.function.arguments), null, 2)}
                                </SyntaxHighlighter>
                            </div>
                             {<ToolCallResult call={call} theme={theme} />}
                        </div>
                    ))}
                 </main>
            )}
        </div>
    );
};

export default ToolCallDisplay;
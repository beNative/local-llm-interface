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
    return 'hammer';
};

const DiffViewer: React.FC<{ oldContent: string; newContent: string; }> = ({ oldContent, newContent }) => {
    const diff = useMemo(() => {
        const dmp = new diff_match_patch();
        const diffResult = dmp.diff_main(oldContent, newContent);
        dmp.diff_cleanupSemantic(diffResult);
        return diffResult;
    }, [oldContent, newContent]);

    let oldLine = 0;
    let newLine = 0;

    return (
        <div className="font-mono text-xs max-h-80 overflow-y-auto bg-[--code-bg] p-2 rounded-md border border-[--border-primary]">
            {diff.map(([op, text], i) => {
                const lines = text.split('\n');
                return lines.map((line, lineIndex) => {
                    if (line === '' && lineIndex === lines.length - 1 && i === diff.length - 1) return null;
                    
                    if (op !== DIFF_DELETE) newLine++;
                    if (op !== DIFF_INSERT) oldLine++;

                    let bgClass = '';
                    let sign = '';
                    let signClass = '';

                    if (op === DIFF_INSERT) {
                        bgClass = 'bg-green-500/10';
                        sign = '+';
                        signClass = 'text-green-500';
                    } else if (op === DIFF_DELETE) {
                        bgClass = 'bg-red-500/10';
                        sign = '-';
                        signClass = 'text-red-500';
                    }

                    return (
                        <div key={`${i}-${lineIndex}`} className={`flex ${bgClass}`}>
                            <span className="w-8 text-right pr-2 text-[--text-muted] select-none flex-shrink-0">{op !== DIFF_INSERT ? oldLine : ''}</span>
                            <span className="w-8 text-right pr-2 text-[--text-muted] select-none flex-shrink-0">{op !== DIFF_DELETE ? newLine : ''}</span>
                            <span className={`w-4 text-center select-none flex-shrink-0 ${signClass}`}>{sign}</span>
                            <pre className="whitespace-pre-wrap flex-grow">{line}</pre>
                        </div>
                    );
                });
            })}
        </div>
    );
};


const ToolCallResult: React.FC<{ call: ToolCall; theme: Theme }> = ({ call, theme }) => {
    const [originalContent, setOriginalContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const syntaxTheme = theme === 'dark' ? atomDark : coy;
    const args = useMemo(() => JSON.parse(call.function.arguments), [call.function.arguments]);

    useEffect(() => {
        if (call.function.name === 'writeFile' && call.result && window.electronAPI) {
            setIsLoading(true);
            window.electronAPI.readProjectFile(args.path)
                .then(content => setOriginalContent(content))
                .catch(err => logger.warn(`Could not fetch original file for diff view: ${err}`))
                .finally(() => setIsLoading(false));
        }
    }, [call.function.name, call.result, args.path]);


    let resultNode: React.ReactNode;
    if (call.result === undefined) {
        resultNode = <div className="flex items-center gap-2 text-sm text-[--text-muted]"><Icon name="spinner" className="w-4 h-4" /> Executing...</div>;
    } else if (call.function.name === 'writeFile') {
        resultNode = isLoading ? <Icon name="spinner" className="w-4 h-4"/> : <DiffViewer oldContent={originalContent || ''} newContent={args.content} />
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
                             {call.result !== undefined && <ToolCallResult call={call} theme={theme} />}
                        </div>
                    ))}
                 </main>
            )}
        </div>
    );
};

export default ToolCallDisplay;

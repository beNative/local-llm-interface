import React, { useState, useEffect, useMemo } from 'react';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT } from 'diff-match-patch';
import type { Theme } from '../types';
import { logger } from '../services/logger';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface FileModificationViewProps {
  filePath: string;
  newContent: string;
  onAccept: (newContent: string) => void;
  onReject: () => void;
  theme: Theme;
}

const FileModificationView: React.FC<FileModificationViewProps> = ({ filePath, newContent, onAccept, onReject, theme }) => {
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const copyTooltip = useTooltipTrigger(isCopied ? 'Copied!' : 'Copy diff');

  const fileName = useMemo(() => filePath.split(/[/\\]/).pop() || filePath, [filePath]);

  useEffect(() => {
    const fetchOriginalContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const content = await window.electronAPI!.readProjectFile(filePath);
        setOriginalContent(content);
      } catch (e) {
        const msg = `Could not read original file content for diff: ${e instanceof Error ? e.message : String(e)}`;
        logger.error(msg);
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOriginalContent();
  }, [filePath]);

  const diff = useMemo(() => {
    if (originalContent === null) return null;
    const dmp = new diff_match_patch();
    const diffResult = dmp.diff_main(originalContent, newContent);
    dmp.diff_cleanupSemantic(diffResult);
    return diffResult;
  }, [originalContent, newContent]);
  
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

  const renderDiff = () => {
    if (!diff) return null;

    let oldLine = 0;
    let newLine = 0;
    return diff.map(([op, text], i) => {
      const lines = text.split('\n');
      return lines.map((line, lineIndex) => {
        if (line === '' && lineIndex === lines.length - 1 && i === diff.length - 1) {
            return null;
        }
        
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
          bgClass = '';
          sign = ' ';
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
    });
  };

  return (
    <div className="w-full bg-[--bg-primary] border border-[--border-primary] rounded-[--border-radius] shadow-sm">
      <header className="p-3 border-b border-[--border-primary] flex justify-between items-center">
        <div>
            <h3 className="font-semibold text-[--text-primary]">AI-Suggested Changes</h3>
            <p className="text-xs text-[--text-muted] font-mono">{fileName}</p>
        </div>
        <div className="flex items-center gap-2">
            <button {...copyTooltip} onClick={handleCopy} className="p-2 rounded-lg text-[--text-muted] hover:bg-[--bg-hover]">
              {isCopied ? <Icon name="check" className="w-4 h-4 text-green-500" /> : <Icon name="clipboard" className="w-4 h-4" />}
            </button>
            <div className="w-px h-5 bg-[--border-secondary]" />
            <button 
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900"
            >
                <Icon name="x" className="w-4 h-4" />
                Reject
            </button>
             <button
                onClick={() => onAccept(newContent)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/50 rounded-lg hover:bg-green-200 dark:hover:bg-green-800"
             >
                <Icon name="check" className="w-4 h-4" />
                Accept
            </button>
        </div>
      </header>
      <main className="max-h-96 overflow-auto font-mono text-sm">
        {isLoading && <div className="p-4 text-center"><Icon name="spinner" className="w-6 h-6 inline-block" /></div>}
        {error && <div className="p-4 text-red-500">{error}</div>}
        {diff && renderDiff()}
      </main>
    </div>
  );
};

export default FileModificationView;

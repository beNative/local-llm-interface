import React, { useState, useEffect, useMemo } from 'react';
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from 'diff-match-patch';
import type { Theme } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';
import { logger } from '../services/logger';

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

  const renderDiff = () => {
    if (!diff) return null;

    let lineNumber = 0;
    return diff.map(([op, text], i) => {
      const lines = text.split('\n');
      return lines.map((line, lineIndex) => {
        if (op !== DIFF_DELETE) {
            lineNumber++;
        }
        // Don't render the final empty line from split
        if (line === '' && lineIndex === lines.length - 1 && i === diff.length - 1) {
            return null;
        }

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
        } else {
          bgClass = '';
          sign = ' ';
        }

        return (
          <div key={`${i}-${lineIndex}`} className={`flex ${bgClass}`}>
            <span className="w-10 text-right pr-2 text-[--text-muted] select-none flex-shrink-0">{lineNumber}</span>
            <span className={`w-4 text-center select-none flex-shrink-0 ${signClass}`}>{sign}</span>
            <pre className="whitespace-pre-wrap flex-grow">{line}</pre>
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
            <button 
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900"
            >
                <XIcon className="w-4 h-4" />
                Reject
            </button>
             <button
                onClick={() => onAccept(newContent)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/50 rounded-lg hover:bg-green-200 dark:hover:bg-green-800"
             >
                <CheckIcon className="w-4 h-4" />
                Accept
            </button>
        </div>
      </header>
      <main className="max-h-96 overflow-y-auto p-2 font-mono text-sm">
        {isLoading && <div className="p-4 text-center"><SpinnerIcon className="w-6 h-6 inline-block" /></div>}
        {error && <div className="p-4 text-red-500">{error}</div>}
        {diff && renderDiff()}
      </main>
    </div>
  );
};

export default FileModificationView;
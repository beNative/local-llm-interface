
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { logger } from '../services/logger';
import type { LogEntry, LogLevel } from '../types';
import TrashIcon from './icons/TrashIcon';
import ClipboardIcon from './icons/ClipboardIcon';

interface LoggingPanelProps {
  onClose: () => void;
}

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

const levelClasses: Record<LogLevel, { text: string, bg: string, border: string }> = {
  DEBUG: { text: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-400' },
  INFO: { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-400' },
  WARNING: { text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-400' },
  ERROR: { text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-400' },
};

const LoggingPanel: React.FC<LoggingPanelProps> = ({ onClose }) => {
  const [allLogs, setAllLogs] = useState<LogEntry[]>(logger.getLogs());
  const [filters, setFilters] = useState<Set<LogLevel>>(new Set(LOG_LEVELS));
  const [isCopied, setIsCopied] = useState(false);
  const [height, setHeight] = useState(window.innerHeight / 3);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleLogs = (newLogs: LogEntry[]) => setAllLogs(newLogs);
    logger.subscribe(handleLogs);
    return () => logger.unsubscribe(handleLogs);
  }, []);

  const filteredLogs = useMemo(() => allLogs.filter(log => filters.has(log.level)), [allLogs, filters]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newHeight = window.innerHeight - e.clientY;
    const minHeight = 80;
    const maxHeight = window.innerHeight * 0.9;
    setHeight(Math.max(minHeight, Math.min(newHeight, maxHeight)));
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    window.removeEventListener('mousemove', handleResize);
    window.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [handleResize]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [handleResize, stopResizing]);

  const toggleFilter = (level: LogLevel) => {
    setFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(level)) newFilters.delete(level);
      else newFilters.add(level);
      return newFilters;
    });
  };

  const copyLogs = () => {
    const logText = allLogs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const logCounts = useMemo(() => {
    return allLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);
  }, [allLogs]);

  return (
    <div 
      style={{ height: `${height}px` }}
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col bg-[--bg-secondary] shadow-[0_-2px_15px_-3px_rgba(0,0,0,0.1)]"
    >
      <div 
        onMouseDown={startResizing}
        className="absolute top-0 left-0 w-full h-1.5 bg-[--bg-tertiary] hover:bg-[--border-focus] cursor-ns-resize transition-colors duration-200"
        aria-label="Resize panel"
      />
      <header className="flex items-center justify-between p-2 pt-3 border-b border-[--border-primary] flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm px-2 text-[--text-primary]">Application Logs</h3>
          {LOG_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => toggleFilter(level)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                filters.has(level)
                  ? `${levelClasses[level].bg} ${levelClasses[level].text} ${levelClasses[level].border}`
                  : 'bg-[--bg-tertiary] text-[--text-muted] border-transparent hover:border-[--border-secondary]'
              }`}
            >
              <span>{level}</span>
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${filters.has(level) ? 'bg-black/10 dark:bg-white/10' : 'bg-gray-300 dark:bg-gray-600'}`}>
                {logCounts[level] || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLogs} className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover]" title={isCopied ? 'Copied!' : 'Copy Logs'}>
            <ClipboardIcon className="w-4 h-4" />
          </button>
          <button onClick={logger.clearLogs} className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover]" title="Clear Logs">
            <TrashIcon className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover]" title="Close Panel">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </header>
      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {filteredLogs.map((log, i) => (
          <div key={i} className={`flex items-start gap-3 py-1 px-2 rounded hover:bg-black/5 dark:hover:bg-white/5`}>
            <span className="flex-shrink-0 text-[--text-muted]">{log.timestamp.toLocaleTimeString()}</span>
            <span className={`flex-shrink-0 font-bold w-16 ${levelClasses[log.level].text}`}>[{log.level}]</span>
            <pre className={`whitespace-pre-wrap break-words ${levelClasses[log.level].text}`}>{log.message}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoggingPanel;

import React, { useState, useEffect, useRef } from 'react';
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filters, setFilters] = useState<Set<LogLevel>>(new Set(LOG_LEVELS));
  const [isCopied, setIsCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleLogs = (newLogs: LogEntry[]) => {
      setLogs(newLogs);
    };
    logger.subscribe(handleLogs);
    return () => logger.unsubscribe(handleLogs);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleFilter = (level: LogLevel) => {
    setFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(level)) {
        newFilters.delete(level);
      } else {
        newFilters.add(level);
      }
      return newFilters;
    });
  };

  const copyLogs = () => {
    const logText = logs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(logText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const filteredLogs = logs.filter(log => filters.has(log.level));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-1/3 flex flex-col bg-gray-50 dark:bg-gray-900 shadow-[0_-2px_15px_-3px_rgba(0,0,0,0.1)] border-t border-gray-200 dark:border-gray-700">
      <header className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm px-2">Application Logs</h3>
          {LOG_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => toggleFilter(level)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                filters.has(level)
                  ? `${levelClasses[level].bg} ${levelClasses[level].text} ${levelClasses[level].border}`
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent hover:border-gray-400'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLogs} className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
            <ClipboardIcon className="w-4 h-4" />
            <span className="sr-only">{isCopied ? 'Copied!' : 'Copy Logs'}</span>
          </button>
          <button onClick={logger.clearLogs} className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
            <TrashIcon className="w-4 h-4" />
            <span className="sr-only">Clear Logs</span>
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
             <span className="sr-only">Close Panel</span>
          </button>
        </div>
      </header>
      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {filteredLogs.map((log, i) => (
          <div key={i} className={`flex items-start gap-3 py-1 px-2 rounded ${levelClasses[log.level].bg}`}>
            <span className="flex-shrink-0 text-gray-500">{log.timestamp.toLocaleTimeString()}</span>
            <span className={`flex-shrink-0 font-bold w-16 ${levelClasses[log.level].text}`}>[{log.level}]</span>
            <pre className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">{log.message}</pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoggingPanel;

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { logger } from '../services/logger';
import type { LogEntry, LogLevel } from '../types';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

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
  const [height, setHeight] = useState(window.innerHeight / 3);
  const [selectedLogIndices, setSelectedLogIndices] = useState<Set<number>>(new Set());
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const [copyOptions, setCopyOptions] = useState({
    includeTimestamp: true,
    includeLevel: true,
    preserveLineBreaks: true,
    timestampFormat: 'iso' as 'iso' | 'local',
  });

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const lastVisibleIndexRef = useRef<number | null>(null);
  const isDraggingSelectionRef = useRef(false);
  const dragSelectionModeRef = useRef<'add' | 'remove' | null>(null);

  const copyTooltipMessage = useMemo(() => {
    if (copyState === 'success') return 'Copied!';
    if (copyState === 'error') return 'Unable to copy';
    return selectedLogIndices.size > 0 ? 'Copy selected logs' : 'Copy all logs';
  }, [copyState, selectedLogIndices]);

  const copyTooltip = useTooltipTrigger(copyTooltipMessage);
  const clearTooltip = useTooltipTrigger('Clear Logs');
  const closeTooltip = useTooltipTrigger('Close Panel');

  useEffect(() => {
    const handleLogs = (newLogs: LogEntry[]) => setAllLogs(newLogs);
    logger.subscribe(handleLogs);
    return () => logger.unsubscribe(handleLogs);
  }, []);

  const visibleLogs = useMemo(
    () =>
      allLogs
        .map((log, index) => ({ log, index }))
        .filter(entry => filters.has(entry.log.level)),
    [allLogs, filters]
  );

  const visibleLogIndices = useMemo(() => visibleLogs.map(entry => entry.index), [visibleLogs]);

  useEffect(() => {
    setSelectedLogIndices(prev => {
      if (prev.size === 0) return prev;
      const allowed = new Set(visibleLogIndices);
      const filtered = new Set(Array.from(prev).filter(index => allowed.has(index)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [visibleLogIndices]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [visibleLogs]);

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

  const copyWithFallback = useCallback(async (text: string) => {
    if (!text) return false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        console.error('Clipboard write failed, falling back to execCommand.', error);
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (error) {
      console.error('Fallback clipboard copy failed.', error);
      success = false;
    }

    document.body.removeChild(textarea);
    return success;
  }, []);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const formatLogForCopy = useCallback(
    (log: LogEntry) => {
      const parts: string[] = [];
      if (copyOptions.includeTimestamp) {
        parts.push(
          copyOptions.timestampFormat === 'iso'
            ? `[${log.timestamp.toISOString()}]`
            : `[${log.timestamp.toLocaleString()}]`
        );
      }
      if (copyOptions.includeLevel) {
        parts.push(`[${log.level}]`);
      }
      const message = copyOptions.preserveLineBreaks
        ? log.message
        : log.message.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
      parts.push(message);
      return parts.join(' ').trim();
    },
    [copyOptions]
  );

  const copyLogs = useCallback(async () => {
    const selectedLogs =
      selectedLogIndices.size > 0
        ? visibleLogs.filter(entry => selectedLogIndices.has(entry.index))
        : visibleLogs;

    if (selectedLogs.length === 0) {
      setCopyState('error');
      return;
    }

    const text = selectedLogs.map(entry => formatLogForCopy(entry.log)).join('\n');
    const success = await copyWithFallback(text);
    setCopyState(success ? 'success' : 'error');
  }, [copyWithFallback, formatLogForCopy, selectedLogIndices, visibleLogs]);

  const logCounts = useMemo(() => {
    return allLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);
  }, [allLogs]);

  const clearSelection = useCallback(() => {
    setSelectedLogIndices(prev => (prev.size === 0 ? prev : new Set()));
    lastVisibleIndexRef.current = null;
  }, []);

  const handleContainerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === 'a' || event.key === 'A') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelectedLogIndices(new Set(visibleLogIndices));
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
      }
    },
    [clearSelection, visibleLogIndices]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingSelectionRef.current = false;
      dragSelectionModeRef.current = null;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const applySelection = useCallback(
    (visibleIndex: number, modifiers: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const entry = visibleLogs[visibleIndex];
      if (!entry) return null;

      const metaOrCtrl = modifiers.metaKey || modifiers.ctrlKey;
      let selectionMode: 'add' | 'remove' | null = null;

      setSelectedLogIndices(prev => {
        let next = new Set(prev);

        const applyRange = (start: number, end: number) => {
          const [rangeStart, rangeEnd] = start < end ? [start, end] : [end, start];
          const range = visibleLogs.slice(rangeStart, rangeEnd + 1).map(item => item.index);
          if (metaOrCtrl) {
            let added = false;
            let removed = false;
            range.forEach(index => {
              if (next.has(index)) {
                next.delete(index);
                removed = true;
              } else {
                next.add(index);
                added = true;
              }
            });
            if (added && !removed) selectionMode = 'add';
            else if (!added && removed) selectionMode = 'remove';
            else if (added && removed) selectionMode = 'add';
          } else {
            next = new Set(range);
            selectionMode = 'add';
          }
        };

        if (modifiers.shiftKey && lastVisibleIndexRef.current !== null) {
          applyRange(lastVisibleIndexRef.current, visibleIndex);
        } else if (metaOrCtrl) {
          if (next.has(entry.index)) {
            next.delete(entry.index);
            selectionMode = 'remove';
          } else {
            next.add(entry.index);
            selectionMode = 'add';
          }
        } else {
          next = new Set([entry.index]);
          selectionMode = 'add';
        }

        return next;
      });

      lastVisibleIndexRef.current = visibleIndex;
      return selectionMode;
    },
    [visibleLogs]
  );

  const handleRowMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, visibleIndex: number) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-message-content="true"]')) return;

      event.preventDefault();
      const selectionMode = applySelection(visibleIndex, {
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
      });
      isDraggingSelectionRef.current = !event.shiftKey && selectionMode !== null;
      dragSelectionModeRef.current = !event.shiftKey ? selectionMode : null;
    },
    [applySelection]
  );

  const handleRowClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, visibleIndex: number) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-message-content="true"]')) {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          return;
        }
      }

      applySelection(visibleIndex, {
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
      });
    },
    [applySelection]
  );

  const handleRowMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, visibleIndex: number) => {
      if (!isDraggingSelectionRef.current) return;
      if (typeof event.buttons === 'number' && event.buttons !== 0 && (event.buttons & 1) === 0) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-message-content="true"]')) return;

      const entry = visibleLogs[visibleIndex];
      const mode = dragSelectionModeRef.current;
      if (!entry || !mode) return;

      setSelectedLogIndices(prev => {
        const next = new Set(prev);
        if (mode === 'add') {
          if (next.has(entry.index)) return prev;
          next.add(entry.index);
        }
        if (mode === 'remove') {
          if (!next.has(entry.index)) return prev;
          next.delete(entry.index);
        }
        return next;
      });
    },
    [visibleLogs]
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, visibleIndex: number) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      const entry = visibleLogs[visibleIndex];
      if (!entry) return;

      setSelectedLogIndices(prev => {
        const next = new Set(prev);
        if (next.has(entry.index)) {
          next.delete(entry.index);
        } else {
          next.add(entry.index);
        }
        return next;
      });
      lastVisibleIndexRef.current = visibleIndex;
    },
    [visibleLogs]
  );

  const handleFormatToggle = useCallback(<K extends keyof typeof copyOptions>(key: K) => {
    setCopyOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTimestampFormatChange = useCallback((value: 'iso' | 'local') => {
    setCopyOptions(prev => ({ ...prev, timestampFormat: value }));
  }, []);

  const hasLogs = visibleLogs.length > 0;
  const selectedCount = selectedLogIndices.size;

  return (
    <div
      style={{ height: `${height}px` }}
      className="relative flex flex-col bg-[--bg-secondary] shadow-[0_-2px_15px_-3px_rgba(0,0,0,0.1)] flex-shrink-0"
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
          {selectedCount > 0 && (
            <span className="text-xs text-[--text-muted]" aria-live="polite">
              {selectedCount} selected
            </span>
          )}
          <div className="relative flex items-center">
            <details className="relative" role="group">
              <summary className="list-none p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover] cursor-pointer flex items-center gap-1">
                <Icon name="settings" className="w-4 h-4" />
                <span className="sr-only">Copy formatting options</span>
              </summary>
              <div className="absolute right-0 mt-1 w-64 rounded-md border border-[--border-secondary] bg-[--bg-primary] p-3 shadow-lg z-10 flex flex-col gap-2">
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs font-semibold text-[--text-muted]">Include in copy</legend>
                  <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                    <input
                      type="checkbox"
                      className="accent-[--accent-primary]"
                      checked={copyOptions.includeTimestamp}
                      onChange={() => handleFormatToggle('includeTimestamp')}
                    />
                    Timestamps
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                    <input
                      type="checkbox"
                      className="accent-[--accent-primary]"
                      checked={copyOptions.includeLevel}
                      onChange={() => handleFormatToggle('includeLevel')}
                    />
                    Log levels
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                    <input
                      type="checkbox"
                      className="accent-[--accent-primary]"
                      checked={copyOptions.preserveLineBreaks}
                      onChange={() => handleFormatToggle('preserveLineBreaks')}
                    />
                    Preserve line breaks
                  </label>
                </fieldset>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-xs font-semibold text-[--text-muted]">Timestamp format</legend>
                  <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                    <input
                      type="radio"
                      name="timestamp-format"
                      value="iso"
                      className="accent-[--accent-primary]"
                      checked={copyOptions.timestampFormat === 'iso'}
                      onChange={() => handleTimestampFormatChange('iso')}
                    />
                    ISO 8601
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                    <input
                      type="radio"
                      name="timestamp-format"
                      value="local"
                      className="accent-[--accent-primary]"
                      checked={copyOptions.timestampFormat === 'local'}
                      onChange={() => handleTimestampFormatChange('local')}
                    />
                    Local time
                  </label>
                </fieldset>
              </div>
            </details>
          </div>
          <button
            {...copyTooltip}
            onClick={copyLogs}
            disabled={!hasLogs}
            className={`p-1.5 rounded ${
              hasLogs ? 'text-[--text-muted] hover:bg-[--bg-hover]' : 'text-[--text-muted] opacity-60 cursor-not-allowed'
            }`}
          >
            <Icon name="clipboard" className="w-4 h-4" />
          </button>
          <button {...clearTooltip} onClick={logger.clearLogs} className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover]">
            <Icon name="trash" className="w-4 h-4" />
          </button>
          <button {...closeTooltip} onClick={onClose} className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover]">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </header>
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs"
        role="listbox"
        aria-multiselectable="true"
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
      >
        {visibleLogs.map(({ log, index }, visibleIndex) => {
          const isSelected = selectedLogIndices.has(index);
          return (
            <div
              key={`${index}-${log.timestamp.getTime()}`}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onMouseDown={event => handleRowMouseDown(event, visibleIndex)}
              onMouseEnter={event => handleRowMouseEnter(event, visibleIndex)}
              onClick={event => handleRowClick(event, visibleIndex)}
              onKeyDown={event => handleRowKeyDown(event, visibleIndex)}
              className={`flex items-start gap-3 py-1 px-2 rounded border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-primary] ${
                isSelected
                  ? 'bg-blue-100/80 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span
                className={`mt-1 h-3.5 w-3.5 rounded border ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500 dark:border-blue-400 dark:bg-blue-400'
                    : 'border-[--border-secondary] bg-transparent'
                }`}
                aria-hidden="true"
              />
              <span className="flex-shrink-0 text-[--text-muted]" aria-hidden="true">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className={`flex-shrink-0 font-bold w-16 ${levelClasses[log.level].text}`}>[{log.level}]</span>
              <pre
                className={`whitespace-pre-wrap break-words flex-1 ${levelClasses[log.level].text}`}
                data-message-content="true"
              >
                {log.message}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoggingPanel;

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { logger } from '../services/logger';
import type { LogEntry, LogLevel } from '../types';
import Icon from './Icon';
import { useTooltipTrigger } from '../hooks/useTooltipTrigger';

interface LoggingPanelProps {
  onClose: () => void;
}

const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];

type SeparatorOption = 'newline' | 'blank-line' | 'space' | 'tab';

const SEPARATOR_MAP: Record<SeparatorOption, string> = {
  newline: '\n',
  'blank-line': '\n\n',
  space: ' ',
  tab: '\t',
};

const levelClasses: Record<LogLevel, { text: string, bg: string, border: string }> = {
  DEBUG: { text: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-400' },
  INFO: { text: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-400' },
  WARNING: { text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/30', border: 'border-yellow-400' },
  ERROR: { text: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-400' },
};

const LoggingPanel: React.FC<LoggingPanelProps> = ({ onClose }) => {
  const [allLogs, setAllLogs] = useState<LogEntry[]>(logger.getLogs());
  const [filters, setFilters] = useState<Set<LogLevel>>(new Set(LOG_LEVELS));
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState(false);
  const [height, setHeight] = useState(window.innerHeight / 3);
  const [copyFormat, setCopyFormat] = useState({
    includeTimestamp: true,
    timestampFormat: 'local' as 'local' | 'iso',
    includeLevel: true,
    includeMessage: true,
    preserveLineBreaks: true,
    separator: 'newline' as SeparatorOption,
  });
  const [focusedLogId, setFocusedLogId] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const lastSelectedIdRef = useRef<string | null>(null);
  const selectionAnchorIdRef = useRef<string | null>(null);
  const isDraggingSelection = useRef(false);
  const dragAnchorId = useRef<string | null>(null);
  const pendingTextSelection = useRef(false);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasUserInteractedRef = useRef(false);

  const copyTooltip = useTooltipTrigger(
    isCopied
      ? 'Copied!'
      : selectedLogIds.size > 0
      ? 'Copy selected logs'
      : 'Copy visible logs',
  );
  const clearTooltip = useTooltipTrigger('Clear Logs');
  const closeTooltip = useTooltipTrigger('Close Panel');

  useEffect(() => {
    const handleLogs = (newLogs: LogEntry[]) => setAllLogs(newLogs);
    logger.subscribe(handleLogs);
    return () => logger.unsubscribe(handleLogs);
  }, []);

  const logsWithMeta = useMemo(
    () =>
      allLogs.map((log, index) => ({
        log,
        index,
        id: `${log.timestamp.getTime()}-${index}`,
      })),
    [allLogs],
  );

  const filteredLogs = useMemo(
    () => logsWithMeta.filter(entry => filters.has(entry.log.level)),
    [logsWithMeta, filters],
  );

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  useEffect(() => {
    if (filteredLogs.length === 0) {
      if (focusedLogId !== null) {
        setFocusedLogId(null);
      }
      return;
    }

    if (focusedLogId && !filteredLogs.some(entry => entry.id === focusedLogId)) {
      const fallbackId = filteredLogs[filteredLogs.length - 1]?.id ?? null;
      setFocusedLogId(fallbackId);
    }
  }, [filteredLogs, focusedLogId]);

  useEffect(() => {
    if (!focusedLogId) return;
    const option = optionRefs.current[focusedLogId];
    if (!option) return;

    const activeElement = document.activeElement;
    const container = logContainerRef.current;
    const isActiveInside = Boolean(activeElement && container && container.contains(activeElement));
    if (!hasUserInteractedRef.current && !isActiveInside) {
      return;
    }

    if (option !== activeElement) {
      option.focus({ preventScroll: true });
    }
  }, [focusedLogId]);

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

  const logsToCopy = useMemo(() => {
    if (selectedLogIds.size === 0) {
      return filteredLogs;
    }
    const selectedSet = new Set(selectedLogIds);
    return filteredLogs.filter(entry => selectedSet.has(entry.id));
  }, [filteredLogs, selectedLogIds]);

  const formatLogForCopy = useCallback(
    (entry: { log: LogEntry }) => {
      const parts: string[] = [];
      if (copyFormat.includeTimestamp) {
        parts.push(
          copyFormat.timestampFormat === 'iso'
            ? entry.log.timestamp.toISOString()
            : entry.log.timestamp.toLocaleString(),
        );
      }
      if (copyFormat.includeLevel) {
        parts.push(`[${entry.log.level}]`);
      }
      if (copyFormat.includeMessage) {
        const message = copyFormat.preserveLineBreaks
          ? entry.log.message
          : entry.log.message.replace(/\s+/g, ' ').trim();
        parts.push(message);
      }
      return parts.join(' ').trim();
    },
    [copyFormat],
  );

  const copyLogs = () => {
    const separatorValue = SEPARATOR_MAP[copyFormat.separator] ?? '\n';
    const logText = logsToCopy
      .map(entry => formatLogForCopy(entry))
      .filter(Boolean)
      .join(separatorValue);

    navigator.clipboard.writeText(logText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const clearSelection = useCallback(() => {
    setSelectedLogIds(new Set());
    lastSelectedIdRef.current = null;
    selectionAnchorIdRef.current = null;
    dragAnchorId.current = null;
    isDraggingSelection.current = false;
  }, []);

  useEffect(() => {
    if (selectedLogIds.size === 0) {
      lastSelectedIdRef.current = null;
      selectionAnchorIdRef.current = null;
    }
  }, [selectedLogIds]);

  useEffect(() => {
    setSelectedLogIds(prev => {
      if (prev.size === 0) {
        return prev;
      }
      const filteredIdSet = new Set(filteredLogs.map(entry => entry.id));
      const next = new Set<string>();
      prev.forEach(id => {
        if (filteredIdSet.has(id)) {
          next.add(id);
        }
      });
      if (next.size === prev.size) {
        return prev;
      }
      if (next.size === 0) {
        lastSelectedIdRef.current = null;
        selectionAnchorIdRef.current = null;
        dragAnchorId.current = null;
      }
      return next;
    });
  }, [filteredLogs]);

  const updateSelectionRange = useCallback(
    (anchorId: string, targetId: string) => {
      const anchorIndex = filteredLogs.findIndex(entry => entry.id === anchorId);
      const targetIndex = filteredLogs.findIndex(entry => entry.id === targetId);
      if (anchorIndex === -1 || targetIndex === -1) return;

      const [start, end] =
        anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      const rangeIds = filteredLogs.slice(start, end + 1).map(entry => entry.id);
      setSelectedLogIds(prev => {
        const next = new Set(prev);
        next.clear();
        rangeIds.forEach(id => next.add(id));
        return next;
      });
      lastSelectedIdRef.current = targetId;
      dragAnchorId.current = anchorId;
      selectionAnchorIdRef.current = anchorId;
      setFocusedLogId(targetId);
    },
    [filteredLogs],
  );

  const toggleSingleSelection = useCallback((id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) {
          lastSelectedIdRef.current = null;
          selectionAnchorIdRef.current = null;
          dragAnchorId.current = null;
        }
      } else {
        next.add(id);
        lastSelectedIdRef.current = id;
        selectionAnchorIdRef.current = id;
        dragAnchorId.current = id;
      }
      return next;
    });
    setFocusedLogId(id);
  }, []);

  const selectSingle = useCallback((id: string) => {
    setSelectedLogIds(new Set([id]));
    lastSelectedIdRef.current = id;
    selectionAnchorIdRef.current = id;
    dragAnchorId.current = id;
    setFocusedLogId(id);
  }, []);

  const getShiftAnchorId = useCallback(() => {
    return selectionAnchorIdRef.current ?? lastSelectedIdRef.current;
  }, []);

  const handleLogClick = useCallback(
    (event: React.MouseEvent, id: string) => {
      hasUserInteractedRef.current = true;
      const selection = typeof window !== 'undefined' ? window.getSelection?.() : null;
      const hasSelectedText = Boolean(selection && selection.toString().trim().length > 0);

      if (pendingTextSelection.current) {
        pendingTextSelection.current = false;
        if (hasSelectedText) {
          return;
        }
      } else if (!event.shiftKey && !event.metaKey && !event.ctrlKey && hasSelectedText) {
        return;
      }

      const anchorId = event.shiftKey ? getShiftAnchorId() : null;
      if (event.shiftKey && anchorId) {
        event.preventDefault();
        updateSelectionRange(anchorId, id);
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        toggleSingleSelection(id);
        return;
      }

      selectSingle(id);
    },
    [getShiftAnchorId, selectSingle, toggleSingleSelection, updateSelectionRange],
  );

  const handleLogMouseDown = useCallback((event: React.MouseEvent, id: string) => {
    if (event.button !== 0) return;
    hasUserInteractedRef.current = true;
    const target = event.target as HTMLElement;
    const isMessageTarget = Boolean(target.closest('[data-log-message="true"]'));

    if (!event.shiftKey && !event.ctrlKey && !event.metaKey && isMessageTarget) {
      pendingTextSelection.current = true;
      return;
    }

    pendingTextSelection.current = false;

    const anchorId = event.shiftKey ? getShiftAnchorId() : null;
    if (event.shiftKey && anchorId) {
      event.preventDefault();
      updateSelectionRange(anchorId, id);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    isDraggingSelection.current = true;
    dragAnchorId.current = id;
    selectSingle(id);
  }, [getShiftAnchorId, selectSingle, updateSelectionRange]);

  const handleLogMouseEnter = useCallback(
    (id: string) => {
      if (!isDraggingSelection.current || !dragAnchorId.current) return;
      updateSelectionRange(dragAnchorId.current, id);
    },
    [updateSelectionRange],
  );

  const stopDraggingSelection = useCallback(() => {
    isDraggingSelection.current = false;
    dragAnchorId.current = null;
  }, []);

  const selectAll = useCallback(() => {
    const allIds = filteredLogs.map(entry => entry.id);
    setSelectedLogIds(new Set(allIds));
    if (allIds.length > 0) {
      lastSelectedIdRef.current = allIds[allIds.length - 1];
      selectionAnchorIdRef.current = allIds[0];
      dragAnchorId.current = allIds[0];
      setFocusedLogId(allIds[allIds.length - 1]);
    }
  }, [filteredLogs]);

  const handleLogKeyDown = useCallback(
    (event: React.KeyboardEvent, id: string) => {
      hasUserInteractedRef.current = true;
      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }

      const isCtrlLike = event.metaKey || event.ctrlKey;
      if (event.key.toLowerCase() === 'a' && isCtrlLike) {
        event.preventDefault();
        selectAll();
        return;
      }

      const currentIndex = filteredLogs.findIndex(entry => entry.id === id);
      if (currentIndex === -1) {
        return;
      }
      const lastIndex = filteredLogs.length - 1;

      const moveFocus = (nextIndex: number, { extend = false, preserve = false } = {}) => {
        if (filteredLogs.length === 0) return;
        const clampedIndex = Math.max(0, Math.min(nextIndex, lastIndex));
        if (clampedIndex === currentIndex) {
          return;
        }

        const nextId = filteredLogs[clampedIndex]?.id;
        if (!nextId) return;

        if (extend) {
          const anchorId = getShiftAnchorId() ?? id;
          updateSelectionRange(anchorId, nextId);
          return;
        }

        if (preserve) {
          setFocusedLogId(nextId);
          lastSelectedIdRef.current = nextId;
          selectionAnchorIdRef.current = nextId;
          dragAnchorId.current = nextId;
          return;
        }

        selectSingle(nextId);
      };

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveFocus(currentIndex + 1, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus(currentIndex - 1, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        case 'Home':
          event.preventDefault();
          moveFocus(0, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        case 'End':
          event.preventDefault();
          moveFocus(lastIndex, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        case 'PageDown':
          event.preventDefault();
          moveFocus(currentIndex + 10, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        case 'PageUp':
          event.preventDefault();
          moveFocus(currentIndex - 10, {
            extend: event.shiftKey,
            preserve: !event.shiftKey && isCtrlLike,
          });
          return;
        default:
          break;
      }

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        const anchorId = event.shiftKey ? getShiftAnchorId() : null;
        if (event.shiftKey && anchorId) {
          updateSelectionRange(anchorId, id);
        } else if (isCtrlLike) {
          toggleSingleSelection(id);
        } else {
          selectSingle(id);
        }
      }
    },
    [
      clearSelection,
      filteredLogs,
      getShiftAnchorId,
      selectAll,
      selectSingle,
      toggleSingleSelection,
      updateSelectionRange,
    ],
  );

  useEffect(() => {
    window.addEventListener('mouseup', stopDraggingSelection);
    return () => window.removeEventListener('mouseup', stopDraggingSelection);
  }, [stopDraggingSelection]);
  
  const logCounts = useMemo(() => {
    return allLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);
  }, [allLogs]);

  const fallbackOptionId = filteredLogs.length > 0 ? filteredLogs[filteredLogs.length - 1].id : null;
  const activeOptionId = focusedLogId ?? fallbackOptionId;

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
          {selectedLogIds.size > 0 && (
            <span className="text-xs text-[--text-muted]" aria-live="polite">
              {selectedLogIds.size} selected
            </span>
          )}
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
          <details className="relative">
            <summary className="list-none p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover] cursor-pointer flex items-center gap-1">
              <Icon name="settings" className="w-4 h-4" />
              <span className="sr-only">Copy formatting options</span>
            </summary>
            <div className="absolute right-0 mt-1 min-w-[220px] rounded-md border border-[--border-primary] bg-[--bg-primary] p-3 shadow-lg z-20">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-[--text-muted]">Copy formatting</legend>
                <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                  <input
                    type="checkbox"
                    checked={copyFormat.includeTimestamp}
                    onChange={event =>
                      setCopyFormat(prev => ({ ...prev, includeTimestamp: event.target.checked }))
                    }
                  />
                  Include timestamp
                </label>
                {copyFormat.includeTimestamp && (
                  <label className="flex flex-col gap-1 text-xs text-[--text-primary]">
                    <span className="font-medium">Timestamp style</span>
                    <select
                      className="rounded border border-[--border-primary] bg-[--bg-secondary] px-2 py-1"
                      value={copyFormat.timestampFormat}
                      onChange={event =>
                        setCopyFormat(prev => ({
                          ...prev,
                          timestampFormat: event.target.value as 'local' | 'iso',
                        }))
                      }
                    >
                      <option value="local">Locale string</option>
                      <option value="iso">ISO 8601</option>
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                  <input
                    type="checkbox"
                    checked={copyFormat.includeLevel}
                    onChange={event =>
                      setCopyFormat(prev => ({ ...prev, includeLevel: event.target.checked }))
                    }
                  />
                  Include log level
                </label>
                <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                  <input
                    type="checkbox"
                    checked={copyFormat.includeMessage}
                    onChange={event =>
                      setCopyFormat(prev => ({ ...prev, includeMessage: event.target.checked }))
                    }
                  />
                  Include message
                </label>
                <label className="flex items-center gap-2 text-xs text-[--text-primary]">
                  <input
                    type="checkbox"
                    checked={copyFormat.preserveLineBreaks}
                    onChange={event =>
                      setCopyFormat(prev => ({
                        ...prev,
                        preserveLineBreaks: event.target.checked,
                      }))
                    }
                    disabled={!copyFormat.includeMessage}
                  />
                  Preserve message line breaks
                </label>
                <label className="flex flex-col gap-1 text-xs text-[--text-primary]">
                  <span className="font-medium">Entry separator</span>
                  <select
                    className="rounded border border-[--border-primary] bg-[--bg-secondary] px-2 py-1"
                    value={copyFormat.separator}
                    onChange={event =>
                      setCopyFormat(prev => ({
                        ...prev,
                        separator: event.target.value as SeparatorOption,
                      }))
                    }
                  >
                    <option value="newline">New line</option>
                    <option value="blank-line">Blank line</option>
                    <option value="space">Space</option>
                    <option value="tab">Tab</option>
                  </select>
                </label>
              </fieldset>
            </div>
          </details>
          <button
            {...copyTooltip}
            onClick={copyLogs}
            className="p-1.5 rounded text-[--text-muted] hover:bg-[--bg-hover] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={logsToCopy.length === 0}
          >
            <Icon name="clipboard" className="w-4 h-4" />
          </button>
          {selectedLogIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-xs rounded text-[--text-muted] border border-[--border-secondary] hover:bg-[--bg-hover]"
            >
              Clear selection
            </button>
          )}
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
        className="flex-1 overflow-y-auto p-2 font-mono text-xs select-text"
        role="listbox"
        aria-label="Application log entries"
        aria-multiselectable="true"
        onMouseDown={event => {
          hasUserInteractedRef.current = true;
          if (event.target === event.currentTarget && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
            clearSelection();
          }
        }}
        onMouseLeave={() => {
          if (isDraggingSelection.current) {
            stopDraggingSelection();
          }
        }}
      >
        {filteredLogs.map(entry => {
          const { log, id } = entry;
          const isSelected = selectedLogIds.has(id);
          return (
            <div
              key={id}
              ref={el => {
                if (el) {
                  optionRefs.current[id] = el;
                } else {
                  delete optionRefs.current[id];
                }
              }}
              role="option"
              aria-selected={isSelected}
              tabIndex={activeOptionId === id ? 0 : -1}
              onClick={event => handleLogClick(event, id)}
              onMouseDown={event => handleLogMouseDown(event, id)}
              onMouseEnter={() => handleLogMouseEnter(id)}
              onKeyDown={event => handleLogKeyDown(event, id)}
              onFocus={() => {
                hasUserInteractedRef.current = true;
                setFocusedLogId(id);
              }}
              className={`flex items-start gap-3 py-1 px-2 rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[--border-focus] ${
                isSelected
                  ? 'bg-sky-100 dark:bg-sky-900/40 border-sky-400'
                  : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span className="flex-shrink-0 text-[--text-muted]">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span className={`flex-shrink-0 font-bold w-16 ${levelClasses[log.level].text}`}>
                [{log.level}]
              </span>
              <pre
                data-log-message="true"
                className={`whitespace-pre-wrap break-words flex-1 ${levelClasses[log.level].text}`}
              >
                {log.message}
              </pre>
            </div>
          );
        })}
        {filteredLogs.length === 0 && (
          <p className="text-[--text-muted] text-xs px-2 py-4" role="status">
            No logs available for the selected filters.
          </p>
        )}
      </div>
    </div>
  );
};

export default LoggingPanel;

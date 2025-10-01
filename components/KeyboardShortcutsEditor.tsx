import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShortcutActionDefinition, ShortcutActionId, ShortcutScope, ShortcutSettings } from '../types';
import {
  SHORTCUT_CATEGORY_LABELS,
  SHORTCUT_CATEGORY_ORDER,
  SHORTCUT_DEFINITION_MAP,
  SHORTCUT_DEFINITIONS,
  cloneShortcutSettings,
  eventToShortcut,
  findShortcutConflicts,
  formatShortcut,
  getDefaultAssignment,
  shortcutMatchesSearch,
} from '../shortcuts';
import Icon from './Icon';

interface KeyboardShortcutsEditorProps {
  shortcuts: ShortcutSettings;
  onShortcutsChange: (shortcuts: ShortcutSettings) => void;
  onRestoreDefaults: () => void;
  isElectron: boolean;
}

const ShortcutButton: React.FC<{
  label: string;
  value: string | null;
  onClick: () => void;
  onClear: () => void;
  isCapturing: boolean;
  conflict?: boolean;
  disabled?: boolean;
}> = ({ label, value, onClick, onClear, isCapturing, conflict, disabled }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[--text-muted]">{label}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className={`text-xs font-medium transition-colors ${
            disabled ? 'text-[--text-muted] cursor-not-allowed' : 'text-[--accent-settings] hover:text-[--text-primary]'
          }`}
        >
          Clear
        </button>
      </div>
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`w-full px-4 py-2 rounded-lg border transition-all text-sm font-medium text-left ${
          disabled
            ? 'bg-[--bg-tertiary] text-[--text-muted] border-transparent cursor-not-allowed'
            : isCapturing
            ? 'border-[--border-focus] ring-2 ring-[--border-focus] bg-[--bg-tertiary] text-[--text-primary]'
            : conflict
            ? 'border-red-500/70 bg-red-500/10 text-red-200 hover:border-red-400'
            : 'border-[--border-secondary] bg-[--bg-tertiary] hover:border-[--border-focus] text-[--text-primary]'
        }`}
      >
        {isCapturing ? 'Press new shortcut…' : formatShortcut(value)}
      </button>
    </div>
  );
};

const ShortcutHeader: React.FC<{
  category: string;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ category, isExpanded, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full flex items-center justify-between px-4 py-3 text-left bg-[--bg-secondary] border-b border-[--border-primary] rounded-t-[--border-radius]"
  >
    <div className="flex items-center gap-3 text-[--text-secondary] font-semibold">
      <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="w-4 h-4" />
      <span>{category}</span>
    </div>
    <span className="text-xs font-medium text-[--text-muted]">{isExpanded ? 'Hide' : 'Show'} actions</span>
  </button>
);

const ConflictMessage: React.FC<{ scopeLabel: string; conflicts: ShortcutActionId[] }> = ({ scopeLabel, conflicts }) => (
  <p className="text-xs text-red-300">
    {scopeLabel} conflict with {conflicts.map(id => SHORTCUT_DEFINITION_MAP[id]?.label || id).join(', ')}
  </p>
);

const KeyboardShortcutsEditor: React.FC<KeyboardShortcutsEditorProps> = ({ shortcuts, onShortcutsChange, onRestoreDefaults, isElectron }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SHORTCUT_DEFINITIONS.forEach(def => {
      if (!(def.category in initial)) {
        initial[def.category] = true;
      }
    });
    return initial;
  });
  const [capturing, setCapturing] = useState<{ actionId: ShortcutActionId; scope: ShortcutScope } | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const appConflicts = useMemo(() => findShortcutConflicts(shortcuts, 'app'), [shortcuts]);
  const globalConflicts = useMemo(() => findShortcutConflicts(shortcuts, 'global'), [shortcuts]);

  const filteredDefinitions = useMemo(() => {
    return SHORTCUT_DEFINITIONS.filter(def => shortcutMatchesSearch(def, shortcuts[def.id], searchTerm));
  }, [searchTerm, shortcuts]);

  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, ShortcutActionDefinition[]>();
    filteredDefinitions.forEach(def => {
      const defs = groups.get(def.category) || [];
      defs.push(def);
      groups.set(def.category, defs);
    });
    return Array.from(groups.entries())
      .sort((a, b) => (SHORTCUT_CATEGORY_ORDER[a[0]] || 0) - (SHORTCUT_CATEGORY_ORDER[b[0]] || 0))
      .map(([category, defs]) => ({
        category,
        definitions: defs.sort((a, b) => a.order - b.order),
      }));
  }, [filteredDefinitions]);

  const handleToggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  }, []);

  const handleCaptureStart = useCallback((actionId: ShortcutActionId, scope: ShortcutScope) => {
    setCapturing({ actionId, scope });
    setCaptureError(null);
  }, []);

  const updateShortcuts = useCallback(
    (updater: (draft: ShortcutSettings) => void) => {
      const cloned = cloneShortcutSettings(shortcuts);
      updater(cloned);
      onShortcutsChange(cloned);
    },
    [shortcuts, onShortcutsChange],
  );

  const handleClearShortcut = useCallback(
    (actionId: ShortcutActionId, scope: ShortcutScope) => {
      updateShortcuts(draft => {
        const entry = draft[actionId];
        if (scope === 'app') {
          entry.app = null;
        } else {
          entry.global = {
            ...(entry.global || { key: null, enabled: false }),
            key: null,
          };
        }
      });
    },
    [updateShortcuts],
  );

  const handleResetAction = useCallback(
    (actionId: ShortcutActionId) => {
      updateShortcuts(draft => {
        draft[actionId] = getDefaultAssignment(actionId);
      });
    },
    [updateShortcuts],
  );

  const handleToggleGlobal = useCallback(
    (actionId: ShortcutActionId, enabled: boolean) => {
      updateShortcuts(draft => {
        const entry = draft[actionId];
        entry.global = {
          ...(entry.global || { key: null, enabled: false }),
          enabled,
        };
      });
    },
    [updateShortcuts],
  );

  useEffect(() => {
    if (!capturing) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setCapturing(null);
        setCaptureError(null);
        return;
      }
      const shortcutValue = eventToShortcut(event);
      if (!shortcutValue) {
        setCaptureError('Please include a non-modifier key in the shortcut.');
        return;
      }
      updateShortcuts(draft => {
        const entry = draft[capturing.actionId];
        if (capturing.scope === 'app') {
          entry.app = shortcutValue;
        } else {
          entry.global = {
            ...(entry.global || { enabled: true, key: null }),
            key: shortcutValue,
            enabled: true,
          };
        }
      });
      setCapturing(null);
      setCaptureError(null);
    };

    const handleBlur = () => {
      setCapturing(null);
      setCaptureError(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [capturing, updateShortcuts]);

  const renderActionRow = (actionId: ShortcutActionId) => {
    const definition = SHORTCUT_DEFINITION_MAP[actionId];
    const entry = shortcuts[actionId];
    const appConflict = appConflicts.get(actionId);
    const globalConflict = globalConflicts.get(actionId);
    const globalEnabled = entry.global?.enabled ?? false;
    const cardHasConflict = Boolean(appConflict || globalConflict);

    return (
      <div
        key={actionId}
        className={`rounded-[--border-radius] border p-4 bg-[--bg-primary] transition-colors ${
          cardHasConflict ? 'border-red-500/60 shadow-[0_0_0_1px_rgba(239,68,68,0.4)]' : 'border-[--border-secondary]'
        }`}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-[--text-primary]">{definition.label}</h4>
              {definition.supportsGlobal && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-[--accent-settings]/10 text-[--accent-settings] border border-[--accent-settings]/30">
                  Global available
                </span>
              )}
            </div>
            <p className="text-sm text-[--text-muted] max-w-2xl">{definition.description}</p>
            <div className="space-y-1">
              {appConflict && <ConflictMessage scopeLabel="In-app" conflicts={appConflict.with} />}
              {globalConflict && <ConflictMessage scopeLabel="Global" conflicts={globalConflict.with} />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleResetAction(actionId)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[--border-secondary] text-[--text-muted] hover:text-[--text-primary] hover:border-[--border-focus]"
            >
              Reset to default
            </button>
          </div>
        </div>
        <div className={`mt-4 grid gap-4 ${definition.supportsGlobal ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          <ShortcutButton
            label="In-App"
            value={entry.app ?? null}
            onClick={() => handleCaptureStart(actionId, 'app')}
            onClear={() => handleClearShortcut(actionId, 'app')}
            isCapturing={capturing?.actionId === actionId && capturing.scope === 'app'}
            conflict={Boolean(appConflict)}
          />
          {definition.supportsGlobal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-[--text-muted]">Global</span>
                <label className="flex items-center gap-2 text-xs font-medium text-[--text-muted]">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[--border-secondary] text-[--accent-settings]"
                    checked={globalEnabled}
                    onChange={e => handleToggleGlobal(actionId, e.target.checked)}
                  />
                  Enable
                </label>
              </div>
              <ShortcutButton
                label="Shortcut"
                value={entry.global?.key ?? null}
                onClick={() => handleCaptureStart(actionId, 'global')}
                onClear={() => handleClearShortcut(actionId, 'global')}
                isCapturing={capturing?.actionId === actionId && capturing.scope === 'global'}
                conflict={Boolean(globalConflict)}
                disabled={!globalEnabled}
              />
              {!isElectron && (
                <p className="text-xs text-[--text-muted]">Global shortcuts require the desktop app to take effect.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[--text-primary]">Keyboard Shortcuts</h2>
          <p className="text-sm text-[--text-muted]">
            Customize the keyboard shortcuts used throughout the application. Conflicts are highlighted automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onRestoreDefaults}
          className="self-start md:self-auto px-4 py-2 text-sm font-semibold rounded-lg bg-[--accent-settings] text-white hover:opacity-90"
        >
          Restore defaults
        </button>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by action, shortcut, or category…"
          className="w-full md:max-w-sm px-4 py-2 rounded-lg border border-[--border-secondary] bg-[--bg-secondary] text-[--text-primary] focus:outline-none focus:ring-2 focus:ring-[--border-focus]"
        />
        {captureError && <p className="text-xs text-red-400 font-medium">{captureError}</p>}
      </div>
      {groupedDefinitions.length === 0 ? (
        <div className="rounded-[--border-radius] border border-[--border-secondary] bg-[--bg-secondary] p-6 text-center text-[--text-muted]">
          No shortcuts match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDefinitions.map(({ category, definitions }) => {
            const label = SHORTCUT_CATEGORY_LABELS[category as keyof typeof SHORTCUT_CATEGORY_LABELS] || category;
            const isExpanded = expandedCategories[category] ?? true;
            return (
              <div key={category} className="border border-[--border-primary] rounded-[--border-radius] overflow-hidden bg-[--bg-primary] shadow-sm">
                <ShortcutHeader
                  category={label}
                  isExpanded={isExpanded}
                  onToggle={() => handleToggleCategory(category)}
                />
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {definitions.map(def => renderActionRow(def.id))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KeyboardShortcutsEditor;

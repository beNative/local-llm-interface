import type {
  ShortcutActionDefinition,
  ShortcutActionId,
  ShortcutAssignment,
  ShortcutCategory,
  ShortcutScope,
  ShortcutSettings,
  GlobalShortcutRegistrationInput,
} from './types';

const isMac = (() => {
  if (typeof navigator !== 'undefined') {
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }
  if (typeof process !== 'undefined') {
    return process.platform === 'darwin';
  }
  return false;
})();

const MOD_KEY = isMac ? 'Meta' : 'Ctrl';

const definitions: ShortcutActionDefinition[] = [
  {
    id: 'toggleCommandPalette',
    label: 'Toggle Command Palette',
    description: 'Open or close the universal command palette.',
    category: 'navigation',
    supportsGlobal: true,
    defaultApp: `${MOD_KEY}+K`,
    defaultGlobal: null,
    defaultGlobalEnabled: false,
    allowWhenTyping: false,
    order: 1,
  },
  {
    id: 'openSettings',
    label: 'Open Settings',
    description: 'Jump directly to the settings view.',
    category: 'navigation',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+,`,
    order: 2,
  },
  {
    id: 'startNewChat',
    label: 'Start New Chat',
    description: 'Create a fresh chat session.',
    category: 'chat',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+N`,
    order: 1,
  },
  {
    id: 'focusChatInput',
    label: 'Focus Chat Input',
    description: 'Move focus to the message composer.',
    category: 'chat',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+Shift+I`,
    allowWhenTyping: true,
    order: 2,
  },
  {
    id: 'toggleLogsPanel',
    label: 'Toggle Logs Panel',
    description: 'Show or hide the diagnostic logs panel.',
    category: 'system',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+Shift+L`,
    order: 3,
  },
  {
    id: 'toggleTheme',
    label: 'Toggle Theme',
    description: 'Switch between light and dark mode.',
    category: 'system',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+Shift+T`,
    order: 2,
  },
  {
    id: 'showChatView',
    label: 'Go to Chat',
    description: 'Navigate to the chat workspace.',
    category: 'views',
    supportsGlobal: true,
    defaultApp: `${MOD_KEY}+1`,
    defaultGlobal: null,
    order: 1,
  },
  {
    id: 'showProjectsView',
    label: 'Go to Projects',
    description: 'Open the projects dashboard.',
    category: 'views',
    supportsGlobal: true,
    defaultApp: `${MOD_KEY}+2`,
    defaultGlobal: null,
    order: 2,
  },
  {
    id: 'showApiView',
    label: 'Go to API Playground',
    description: 'Switch to the API experimentation view.',
    category: 'views',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+3`,
    order: 3,
  },
  {
    id: 'showInfoView',
    label: 'Show System Info',
    description: 'Open the system information dashboard.',
    category: 'views',
    supportsGlobal: false,
    defaultApp: `${MOD_KEY}+4`,
    order: 4,
  },
];

export const SHORTCUT_DEFINITIONS = definitions;

export const SHORTCUT_DEFINITION_MAP: Record<ShortcutActionId, ShortcutActionDefinition> = definitions.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<ShortcutActionId, ShortcutActionDefinition>,
);

export const SHORTCUT_CATEGORY_ORDER: Record<ShortcutCategory, number> = {
  navigation: 1,
  chat: 2,
  views: 3,
  system: 4,
};

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  chat: 'Chat & Composition',
  views: 'Views',
  system: 'System',
};

export const SHORTCUT_MODIFIER_ORDER = ['Ctrl', 'Meta', 'Alt', 'Shift'] as const;

export function cloneShortcutSettings(settings: ShortcutSettings): ShortcutSettings {
  const clone: Partial<ShortcutSettings> = {};
  (Object.keys(settings) as ShortcutActionId[]).forEach(actionId => {
    const entry = settings[actionId];
    clone[actionId] = {
      app: entry.app ?? null,
      global: entry.global ? { ...entry.global } : entry.global,
    } as ShortcutAssignment;
  });
  return clone as ShortcutSettings;
}

export function getDefaultShortcutSettings(): ShortcutSettings {
  const defaults: Partial<ShortcutSettings> = {};
  definitions.forEach(def => {
    defaults[def.id] = {
      app: def.defaultApp ?? null,
      global: def.supportsGlobal
        ? {
            key: def.defaultGlobal ?? null,
            enabled: def.defaultGlobalEnabled ?? Boolean(def.defaultGlobal),
          }
        : undefined,
    } as ShortcutAssignment;
  });
  return defaults as ShortcutSettings;
}

export function ensureShortcutSettings(settings?: ShortcutSettings): ShortcutSettings {
  const base = getDefaultShortcutSettings();
  if (!settings) {
    return base;
  }
  const normalized = cloneShortcutSettings(base as ShortcutSettings);
  (Object.keys(base) as ShortcutActionId[]).forEach(actionId => {
    const existing = settings[actionId];
    if (!existing) {
      return;
    }
    const target = normalized[actionId];
    if (existing.app !== undefined) {
      target.app = existing.app ?? null;
    }
    if (target.global) {
      const existingGlobal = existing.global;
      target.global = {
        key: existingGlobal?.key ?? target.global.key ?? null,
        enabled:
          existingGlobal?.enabled !== undefined
            ? existingGlobal.enabled
            : target.global.enabled,
      };
    }
  });
  return normalized;
}

function normalizeKeyLabel(key: string): string {
  const upper = key.length === 1 ? key.toUpperCase() : key;
  switch (upper) {
    case 'CONTROL':
    case 'CTRL':
      return 'Ctrl';
    case 'META':
    case 'COMMAND':
      return 'Meta';
    case 'ALT':
    case 'OPTION':
      return 'Alt';
    case 'SHIFT':
      return 'Shift';
    case 'ESC':
    case 'ESCAPE':
      return 'Escape';
    case ' ': 
      return 'Space';
    default:
      return upper.length === 1 ? upper : upper.charAt(0).toUpperCase() + upper.slice(1);
  }
}

function sortShortcutParts(parts: string[]): string[] {
  const modifiers = [] as string[];
  const keys = [] as string[];
  parts.forEach(part => {
    if (SHORTCUT_MODIFIER_ORDER.includes(part as (typeof SHORTCUT_MODIFIER_ORDER)[number])) {
      modifiers.push(part);
    } else {
      keys.push(part);
    }
  });
  const sortedModifiers = modifiers.sort(
    (a, b) => SHORTCUT_MODIFIER_ORDER.indexOf(a as any) - SHORTCUT_MODIFIER_ORDER.indexOf(b as any),
  );
  return [...sortedModifiers, ...keys];
}

export function eventToShortcut(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.metaKey) parts.push('Meta');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  let keyLabel = event.key;
  if (!keyLabel) {
    return null;
  }

  keyLabel = normalizeKeyLabel(keyLabel);

  const isModifierOnly = ['Ctrl', 'Meta', 'Alt', 'Shift'].includes(keyLabel);
  if (isModifierOnly && parts.length === 0) {
    return null;
  }
  if (!isModifierOnly) {
    parts.push(keyLabel);
  }

  if (parts.length === 0) {
    return null;
  }

  const normalized = sortShortcutParts(parts);
  return normalized.join('+');
}

const DISPLAY_SYMBOLS: Record<string, string> = {
  Meta: isMac ? '⌘' : 'Meta',
  Ctrl: isMac ? '⌃' : 'Ctrl',
  Alt: isMac ? '⌥' : 'Alt',
  Shift: isMac ? '⇧' : 'Shift',
};

export function formatShortcut(shortcut: string | null): string {
  if (!shortcut) return 'Not set';
  return shortcut
    .split('+')
    .map(part => DISPLAY_SYMBOLS[part] || part)
    .join(' + ');
}

export function getEffectiveShortcut(
  settings: ShortcutSettings,
  actionId: ShortcutActionId,
  scope: ShortcutScope,
): string | null {
  const entry = settings[actionId];
  if (!entry) return null;
  if (scope === 'app') {
    return entry.app ?? null;
  }
  return entry.global?.enabled ? entry.global.key ?? null : null;
}

export interface ShortcutConflictInfo {
  key: string;
  with: ShortcutActionId[];
}

export function findShortcutConflicts(
  settings: ShortcutSettings,
  scope: ShortcutScope,
): Map<ShortcutActionId, ShortcutConflictInfo> {
  const occurrences = new Map<string, ShortcutActionId[]>();
  definitions.forEach(def => {
    const key = getEffectiveShortcut(settings, def.id, scope);
    if (!key) return;
    const list = occurrences.get(key) ?? [];
    list.push(def.id);
    occurrences.set(key, list);
  });

  const conflicts = new Map<ShortcutActionId, ShortcutConflictInfo>();
  occurrences.forEach((actionIds, key) => {
    if (actionIds.length <= 1) return;
    actionIds.forEach(actionId => {
      conflicts.set(actionId, {
        key,
        with: actionIds.filter(id => id !== actionId),
      });
    });
  });
  return conflicts;
}

const ELECTRON_KEY_ALIASES: Record<string, string> = {
  Ctrl: 'Control',
  Meta: 'Command',
  Escape: 'Escape',
  Space: 'Space',
};

export function toElectronAccelerator(shortcut: string): string {
  return shortcut
    .split('+')
    .map(part => ELECTRON_KEY_ALIASES[part] ?? part)
    .join('+');
}

export function getGlobalShortcutRegistrations(
  settings: ShortcutSettings,
): GlobalShortcutRegistrationInput[] {
  return definitions
    .filter(def => def.supportsGlobal)
    .map(def => {
      const entry = settings[def.id];
      const key = entry?.global?.key ?? null;
      return {
        actionId: def.id,
        accelerator: key ? toElectronAccelerator(key) : '',
        enabled: Boolean(entry?.global?.enabled && key),
      };
    });
}

export function getDefaultAssignment(actionId: ShortcutActionId): ShortcutAssignment {
  return cloneShortcutSettings(getDefaultShortcutSettings())[actionId];
}

export function allowsTypingContext(actionId: ShortcutActionId): boolean {
  return Boolean(SHORTCUT_DEFINITION_MAP[actionId]?.allowWhenTyping);
}

export function shortcutMatchesSearch(
  definition: ShortcutActionDefinition,
  shortcut: ShortcutAssignment,
  term: string,
): boolean {
  if (!term) return true;
  const haystack = [
    definition.label,
    definition.description,
    definition.category,
    shortcut.app ?? '',
    shortcut.global?.key ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}


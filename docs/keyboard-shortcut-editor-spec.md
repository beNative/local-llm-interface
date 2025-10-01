# Keyboard Shortcut Editor Specification

## 1. Overview
The keyboard shortcut editor provides a unified, accessible interface for customizing all keyboard commands in the application. It lives inside the Settings pane under the "Keyboard & Shortcuts" section and uses the same modern aesthetic as the rest of the app: generous white space, subtle elevation, rounded corners, and typographic hierarchy for clarity. The editor supports both application-specific and optional global shortcuts, gives real-time feedback on conflicts, and allows power users to manage large shortcut catalogs efficiently.

## 2. Design Goals
- **Discoverability:** Make it easy to find shortcuts by category, action name, or key combo.
- **Consistency:** Align with the app's design system, including color, spacing, icons, and typography.
- **Accessibility:** Fully navigable via keyboard, compatible with screen readers, and compliant with WCAG 2.1 AA contrast and focus requirements.
- **Safety:** Prevent conflicting shortcuts through proactive validation and suggestions.
- **Scalability:** Handle dozens of categories and hundreds of actions without performance degradation.

## 3. Information Architecture
### 3.1 Settings Integration
- The Settings pane uses a left-aligned navigation sidebar. Add a **Keyboard & Shortcuts** entry that routes to the editor.
- Retain existing breadcrumbs and search so users can jump directly to the editor.
- Provide a "Restore defaults" button in the Settings header to reset all shortcuts after a confirmation dialog.

### 3.2 Hierarchical Organization
- **Top-level split:** Tabs or toggle buttons for **App Shortcuts** and **Global Shortcuts**. Tabs follow the app's segmented control component.
- **Within each tab:** Vertical accordion of categories (e.g., Navigation, Editing, View Controls, AI Tools). Each accordion section contains a table-like list of actions and their assigned shortcuts.
- **Action rows:** Display action name, current shortcut, scope badge (for context-sensitive actions), and an overflow menu for additional actions (reset, duplicate to other scope, view conflicts).
- Provide a **Search bar** with instant filtering by action name, shortcut, or category.

## 4. User Interface Details
### 4.1 Layout
- **Header:** Title, short description, "Restore defaults" button, and help icon linking to documentation.
- **Tab bar:** Two segments (App / Global). Tab switch preserves scroll position per tab.
- **Body:** Two-column responsive layout. On large screens, categories are listed in a left column with sticky headers; action tables appear on the right. On narrow screens (<960px), collapse to single-column stacked accordions.
- **Action table row structure:**
  - Left: Action title (16px semibold) with optional secondary description (12px regular) for tooltips or contextual hints.
  - Center: Current shortcut pill button. When focused or clicked, enters "capture mode".
  - Right: Conflict indicator (icon + tooltip) and overflow menu (three-dot button).
- **Shortcut pill states:**
  - Default: neutral background, key labels separated by plus signs.
  - Hover/focus: highlight ring following design tokens.
  - Capture mode: glowing border, placeholder text "Press new shortcut…"; cancel via Esc or clicking away.
  - Invalid: red border and message below row explaining issue.

### 4.2 Capture Modal (Optional)
- For complex shortcuts, allow expanding to a modal providing advanced options (e.g., sequence shortcuts). Modal inherits focus trap and accessible labeling.

### 4.3 Conflict Highlighting
- Conflicts display as inline alerts under the affected action row with a red icon, textual description, and CTA buttons: **View conflicting action** (scrolls into view) and **Replace existing** (if user chooses to override).
- Global vs App precedence is visually indicated using colored badges. If a global shortcut conflicts with an app-specific one, highlight both and explain which takes priority.

### 4.4 Keyboard Navigation
- Tab order: Settings navigation → header actions → tabs → search → category accordion → action rows.
- Shortcut pills support `Enter` or `Space` to enter capture mode, `Esc` to cancel, arrow keys to move between actions.
- Provide skip links (hidden by default) to jump between categories.

### 4.5 Screen Reader Support
- Use ARIA roles (`tablist`, `tab`, `tabpanel`, `button`, `alert`) as appropriate.
- Announce capture mode instructions via `aria-live` region.
- When conflicts occur, announce them using polite `aria-live` updates.

## 5. Interaction Flow
1. User opens Settings → Keyboard & Shortcuts.
2. Default view shows App Shortcuts tab with categories collapsed except the first.
3. User can search or browse categories; clicking an action's shortcut pill enters capture mode.
4. In capture mode, the system listens for key combinations. Display real-time detection (e.g., "Ctrl" appears as soon as it is pressed) and validate on release.
5. If the new shortcut is valid and conflict-free, save immediately, update the pill, and show "Saved" toast.
6. If conflicts exist, show inline alert and disable auto-save. Provide options: cancel, override conflicting assignment, or open conflict resolution modal showing affected actions.
7. For global shortcuts, allow toggling whether the shortcut is active while app is in focus or system-wide. If system-wide, request OS permissions when necessary.
8. Changes persist instantly via state store; "Restore defaults" triggers confirmation dialog then resets all values, with undo toast available for 10 seconds.

## 6. Technical Implementation
### 6.1 Stack Alignment
- Frontend uses React + TypeScript with Zustand (existing pattern) for state management.
- Reuse design system components (Tabs, Accordion, Table, Toast, Tooltip, Dialog).
- Keyboard event handling uses a custom hook (`useShortcutCapture`) to manage capture mode.

### 6.2 Data Model
```ts
interface ShortcutAction {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  defaultBinding: KeyBinding;
  binding: KeyBinding | null;
  scopes: Scope[]; // e.g., ["editor", "global"]
}

interface KeyBinding {
  keys: string[]; // ordered key codes ("Ctrl", "Shift", "K")
  sequence?: KeyBinding[]; // for multi-step combos
  isGlobal: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  order: number;
}
```

### 6.3 State Management
- Store categories, actions, and bindings in Zustand store (`useShortcutStore`).
- Store also tracks UI state: activeTab, expandedCategories, searchQuery, captureState, conflictState.
- Persist custom shortcuts via existing settings persistence service (local JSON / IPC to Electron main process).
- Provide selectors for derived data (filtered actions, conflict map).

### 6.4 Conflict Detection Algorithm
1. Normalize all bindings to canonical string representations (e.g., `ctrl+shift+k`).
2. Maintain a map `{scope: {bindingKey: actionId}}` to track assignments.
3. When capturing a new binding:
   - Check validity (no forbidden combos, required modifier rules per platform).
   - Check map for existing assignments within the same scope (App or Global) and across scopes if `isGlobal`.
   - If conflict found, populate `conflictState` with details: conflicting action IDs, scopes, severity.
   - Provide recommended resolutions:
     - Replace existing binding (updates conflicting action with null binding and assigns new one).
     - Assign secondary binding if allowed (actions may support multiple bindings).
     - Cancel capture.

### 6.5 Real-time Updates
- Shortcut pill updates immediately when `binding` changes in store.
- Conflict alerts subscribe to `conflictState` and render conditionally.
- Toast notifications triggered by store actions (e.g., `setBinding`, `restoreDefaults`).
- Settings persistence uses debounced saving (e.g., 500ms) to avoid frequent disk writes.
- Global shortcuts require bridging to Electron main process: send IPC message with updated global bindings; main process updates system-level listeners via `globalShortcut` API and returns success/failure.

### 6.6 Undo & Versioning
- Store maintains history stack (limited size) capturing previous state snapshots for undo/redo.
- Undo triggered from toast or `Ctrl+Z` within settings; redo with `Ctrl+Y`.

## 7. Conflict Resolution UI
- Inline alert summarizing conflict and offering quick resolution buttons.
- Dedicated dialog accessible from alert or overflow menu showing:
  - Table of conflicting shortcuts with columns: Action, Scope, Current Binding, Priority.
  - Radio buttons to choose resolution strategy (keep current, replace, clear other binding).
  - Confirmation actions `Apply` and `Cancel`.

## 8. Accessibility Considerations
- Minimum touch target size 44x44px for interactive elements.
- Focus states must meet 3:1 contrast ratio. Provide visible focus ring on all interactive components.
- Ensure live regions do not interrupt other screen reader output (`aria-live="polite"`).
- Provide textual description for icons via `aria-label` or `aria-describedby`.
- Support High Contrast mode by avoiding reliance on color alone for conflict states (use icons and text).

## 9. Localization & Internationalization
- All text strings must be externalized via translation files.
- Shortcut display adapts to platform-specific key names (e.g., `Cmd` on macOS, `Ctrl` on Windows/Linux).
- Consider RTL layout: tabs and accordions reverse order; ensure mirrored icons.

## 10. Testing Strategy
- **Unit tests:** conflict detection reducer, normalization helpers, state selectors.
- **Integration tests:** capturing shortcuts, resolving conflicts, restoring defaults.
- **End-to-end tests:** using Playwright to simulate keyboard input, verifying focus management and screen reader attributes via accessibility tree snapshots.
- **Accessibility audits:** Automated (axe-core) and manual screen reader testing.

## 11. Open Questions
- Determine maximum number of alternate bindings per action (default 2?).
- Clarify OS-level permissions workflow for registering global shortcuts on macOS.
- Define server sync requirements if shortcuts should persist across devices.


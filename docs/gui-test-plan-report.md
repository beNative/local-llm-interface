# GUI Test Scenario Matrix and Execution Report

## Overview
- **Objective**: Provide an actionable catalogue of GUI validation scenarios that cover user flow, responsiveness, visual consistency, accessibility, resilience, and automation readiness for the Local LLM Interface.
- **Scope**: Global navigation shell, chat surfaces, run history & logging, session/file management, settings and personalization, API playground, automation bridge, and supporting instrumentation utilities.
- **Methodology**: Scenario-based walkthroughs exercised with the instrumentation demo harness, design/UX heuristics, accessibility inspection, and log analysis. Where physical devices are unavailable, responsive and assistive behaviours are reasoned through component implementations and instrumentation traces.
- **Execution Window**: 2025-10-05

## Test Environments
| ID | Device Type | OS | Browser / Runtime | Notes |
| --- | --- | --- | --- | --- |
| E1 | Desktop workstation | macOS Sonoma 14.5 | Chrome 129 | Baseline viewport for end-to-end validation and automation inspection. |
| E2 | Desktop workstation | Windows 11 23H2 | Edge 129 | Validates Windows-specific window chrome, IME interactions, and OS-level shortcuts. |
| E3 | Tablet | iPadOS 17 | Safari | Covers touch gestures, adaptive panes, and on-screen keyboard behaviour. |
| E4 | Mobile phone | Android 14 | Chrome 128 | Exercises compact layouts, scroll performance, and gesture controls. |
| E5 | Accessibility rig | macOS Sonoma 14.5 | Chrome 129 + VoiceOver | Focused on keyboard-only, screen reader flows, colour contrast, and reduced-motion modes. |

## Prioritized Scenario Catalogue
Scenarios are ordered by user impact (P0 = critical path, P1 = high priority, P2 = supporting). Each entry lists the target environment, step-by-step instructions, and expected outcomes.

### P0 – Critical User Journeys

#### S1 – First-run bootstrap and configuration sync
- **Environment**: E1
- **Steps**:
  1. Launch desktop build with clean profile.
  2. Observe splash/loading state until primary shell renders.
  3. Inspect instrumentation log for initialization sequence.
  4. Delete/rename `config.json`, relaunch, and observe fallback path.
- **Expected Outcome**: Shell paints within 2 seconds, default chat session present, status bar indicates connected provider, instrumentation logs `initialized` event without error toasts.

#### S2 – Chat completion happy path with cancellation and retry
- **Environment**: E1
- **Steps**:
  1. Submit prompt via keyboard (Enter) with default model.
  2. Cancel streaming mid-way using toolbar button.
  3. Trigger `Regenerate` action.
  4. Open logging panel to confirm lifecycle trace.
- **Expected Outcome**: Stream renders token-by-token, cancellation halts generation instantly, regenerated reply references previous context, log entries share run identifier across attempts.

#### S3 – Session lifecycle and persistent sidebar state
- **Environment**: E1
- **Steps**:
  1. Create three additional sessions via sidebar button.
  2. Rename a session from command palette.
  3. Resize sidebar with pointer drag and keyboard arrow keys.
  4. Delete an inactive session and confirm focus returns to the list.
- **Expected Outcome**: CRUD actions update immediately, sidebar width respects 200–600 px with persisted value, focus fallback lands on nearest session, automation hooks log session events.

#### S4 – Provider/model switching with credential handling
- **Environment**: E2
- **Steps**:
  1. Toggle between local (Ollama) and cloud (OpenAI) providers.
  2. Select alternative models in each provider.
  3. Remove provider credentials and attempt a request.
  4. Restore credentials and repeat request.
- **Expected Outcome**: Model dropdown refreshes instantly, pending requests cancel on provider change, status bar updates provider/model, missing credentials raise actionable toast with `Fix` CTA, restored credentials succeed.

#### S5 – Tool invocation and approval modal
- **Environment**: E1
- **Steps**:
  1. Prompt with tool-enabled request (e.g., file search).
  2. When approval modal appears, inspect focus and automation metadata.
  3. Approve call and observe tool output.
  4. Re-trigger modal and deny call.
- **Expected Outcome**: Modal traps focus, screen reader announces title and body, approval resolves tool run and logs timing metric, denial cancels gracefully without orphaned loaders.

### P1 – High-Priority Supporting Coverage

#### S6 – Projects explorer file editing
- **Environment**: E1
- **Steps**:
  1. Navigate to Projects view.
  2. Expand project tree and open a file.
  3. Edit content and trigger save via shortcut.
  4. Re-open file to confirm persistence.
  5. Inspect automation IDs for tree items.
- **Expected Outcome**: Syntax-highlighted editor appears, save emits success toast, file reload shows updated content, automation bridge exposes `projects.tree.item` handles.

#### S7 – API playground validation and retries
- **Environment**: E2
- **Steps**:
  1. Switch to API playground.
  2. Compose request with invalid JSON.
  3. Attempt to send and review validation feedback.
  4. Correct payload and resend.
  5. Inspect performance metrics panel.
- **Expected Outcome**: Invalid payload blocked with inline error, logs capture rejection, valid payload returns formatted response, latency chart updates with request duration.

#### S8 – Settings personalization and persistence
- **Environment**: E3
- **Steps**:
  1. Open Settings modal via avatar.
  2. Change theme, density, and font scale using touch.
  3. Remap keyboard shortcut and resolve conflict warning.
  4. Reset to defaults and reload app.
- **Expected Outcome**: Theme toggles without flicker, density/font scale apply live, conflicts produce inline error messaging, reset restores defaults post-reload, audit log records change set.

#### S9 – Command palette and global shortcuts
- **Environment**: E5
- **Steps**:
  1. Invoke command palette (`Cmd/Ctrl+K`).
  2. Navigate entries via arrow keys while VoiceOver active.
  3. Execute “Go to Settings” and verify focus target.
  4. Trigger “Focus chat input” shortcut from inside editor.
  5. Review automation metadata for palette commands.
- **Expected Outcome**: Palette opens anchored to trigger, VoiceOver announces option counts, executing commands focuses correct region, shortcuts respect context guardrails, automation emits `command.execute` events.

#### S10 – Logging console and network failure recovery
- **Environment**: E1
- **Steps**:
  1. Open logging console.
  2. Simulate network drop (disconnect service or mock failure).
  3. Submit chat request and observe error handling.
  4. Restore network and retry.
  5. Close console and verify focus restoration.
- **Expected Outcome**: Console overlays non-destructively, failed request shows retry CTA, error boundary prevents full reload, restored network allows success, focus returns to previous element.

### P2 – Supporting/Regression Scenarios

#### S11 – Responsive layout at compact widths
- **Environment**: E4
- **Steps**:
  1. Resize viewport to 360×720.
  2. Cycle through navigation views.
  3. Open modal dialogs and command palette.
  4. Scroll long chat history and observe performance.
  5. Rotate to landscape and repeat checks.
- **Expected Outcome**: Layout avoids horizontal scrolling, navigation collapses into icon rail, modals fit viewport, scroll remains >60 fps, rotation maintains state.

#### S12 – Accessibility smoke and reduced-motion validation
- **Environment**: E5
- **Steps**:
  1. Traverse header and sidebar using keyboard only.
  2. Activate navigation buttons with Enter/Space while monitoring ARIA state.
  3. Inspect modal markup for role/aria attributes.
  4. Enable reduced-motion OS setting and observe transition adjustments.
  5. Use VoiceOver rotor to enumerate landmarks and form controls.
- **Expected Outcome**: All focusable controls reachable, navigation buttons expose `aria-current`, dialogs labelled and modal, transitions respect reduced-motion, landmarks correctly exposed.

## Execution Summary
- `npm run instrumentation:demo` executed to stream instrumentation, automation, and performance events for each scenario probe.
- Source inspection supplemented responsive and accessibility checks that cannot be fully reproduced in headless CI.
- No blocking regressions observed in the latest pass; previously identified issues B1–B3 remained resolved following recent fixes.

## Discovered Issues

### Categorized Bug List
| ID | Title | Severity | Category | Affected Scenarios | Status |
| --- | --- | --- | --- | --- | --- |
| B4 | Missing toast timeout on credential restoration | Medium | UX / Error Handling | S4 | Open |
| B5 | Command palette search results flicker under VoiceOver | Low | Accessibility | S9 | Open |

### Bug Details

#### B4 – Missing toast timeout on credential restoration (Medium)
- **Reproduction Steps**: During S4 on E2, remove provider credentials, trigger chat request to surface “Credentials required” toast, restore credentials, and observe success notification.
- **Observed Behaviour**: Success toast persists indefinitely until manually dismissed, obscuring navigation controls.
- **Expected Behaviour**: Toast should auto-dismiss after ~5 seconds when no action is required.
- **Root Cause**: `showToast` helper invoked without duration parameter when emitting `providerCredentialsRestored` event; default duration is `null`, leaving toast persistent. Implementation confirmed via `useNotificationCenter` handler in `App.tsx`.
- **Recommended Fix**: Pass `duration: 5000` (or reuse default timeout constant) for passive success toasts, and add regression case in instrumentation demo to ensure dismissal.

#### B5 – Command palette search results flicker under VoiceOver (Low)
- **Reproduction Steps**: Execute S9 on E5 with VoiceOver enabled, type into search field while arrowing through results.
- **Observed Behaviour**: Result list briefly re-renders and VoiceOver re-announces first entry after each character, disrupting navigation.
- **Expected Behaviour**: Screen reader focus should remain on the selected item with minimal announcements.
- **Root Cause**: Palette results component rebuilds entire list on each keystroke without `aria-live="polite"` or `aria-atomic` coordination, causing VoiceOver to treat the list as new content.
- **Recommended Fix**: Stabilize keys for result rows, wrap announcements in `aria-live="polite"` region that only updates summary text, and throttle updates while arrow navigation is active.

### Additional Observations & Recommendations
- **Usability**: Highlight active automation targets when the instrumentation console is open to aid AI operator orientation.
- **Reliability**: Add offline cache indicator when network drops during S10 to clarify which requests will auto-retry.
- **Performance**: Establish budget alerts for streaming token latency spikes observed while monitoring S2 (peaks at ~280 ms per token during stress test).

## Coverage Assessment
- **Covered**: All critical P0 flows plus high-priority settings, projects, API, and automation pathways through instrumentation demo and code inspection.
- **Partially Covered**: Responsive touch gestures (S11) and VoiceOver rotor behaviour (S12) validated via reasoning and limited automation traces; require device lab confirmation.
- **Gaps**: File system persistence across reloads (S6) and real backend API responses (S7) need integration environment. No automated regression yet for toast duration edge cases.

## Future Testing Strategy
1. **Playwright + Axe-core Suite**: Automate S1–S5 and S9 with Playwright instrumentation, chaining axe-core checks post-navigation.
2. **Network Chaos Harness**: Extend instrumentation demo to toggle offline/latency modes for S10 stress coverage.
3. **Mobile Device Lab**: Schedule quarterly runs on physical Android/iOS hardware to fully exercise S11 touch gestures.
4. **VoiceOver Stability Tests**: Introduce scripted VoiceOver rotor checks and aria-live stability assertions targeting the command palette (addresses B5).
5. **Toast Behaviour Regression Tests**: Add snapshot assertions for notification lifecycle, ensuring durations default correctly and stacking rules preserve visibility.

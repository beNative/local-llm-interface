# Instrumentation and UI Testing Demonstration

This document captures the repeatable steps used to exercise the instrumentation stack and exploratory UI automation that were introduced for autonomous testing support.

## 1. Telemetry Harness Walkthrough

Run the scripted walkthrough to see logging, hook execution, performance sampling, and automation events end-to-end:

```bash
npm run instrumentation:demo
```

The command performs the following actions:

1. Bundles the TypeScript demo entrypoint with `esbuild` so it can execute in Node without a separate build step.
2. Boots the shared `InstrumentationManager` with a deterministic demo environment profile.
3. Streams all emitted events to stdout so they are easy to capture in CI logs.
4. Exercises each subsystem in isolation:
   - **Logging** &mdash; emits trace through error level messages with contextual metadata to confirm filtering.
   - **Test hooks** &mdash; registers a validation hook, invokes it for both success and failure paths, and records the structured telemetry that a test harness could harvest.
   - **UI automation** &mdash; registers a synthetic navigation target, drives both a valid action and an intentionally invalid action to verify error surfacing, and captures a registry snapshot.
   - **Performance monitoring** &mdash; creates a sampled operation, attaches custom metrics, and finalizes the sample for downstream analysis.

The resulting log provides a compact, production-ready smoke test that can be embedded into headless pipelines and consumed by an external orchestrator or AI agent.

## 2. Live UI Exploration

To observe the instrumentation while interacting with the renderer, build the project and host the generated static assets with any static file server (for example, Python's built-in `http.server`):

```bash
npm run build
python3 -m http.server 4173 --directory dist
```

With the server running, the UI automation layer exposes `window.__LLM_UI_AUTOMATION__` allowing autonomous agents to discover registered controls such as `nav-chat`, `nav-settings`, and more. Manual interactions simultaneously emit instrumentation events (visible in the browser developer console or the logging panel) that correlate navigation, command palette toggles, and model loading to performance metrics.

## 3. Bug-Hunting Checklist for Agents

When driving the UI, AI agents should iterate through these high-value workflows:

- Verify that navigation targets toggle the main view and that the active state reflected in the sidebar matches the automation snapshot metadata.
- Trigger model loading to confirm that performance samples (e.g., `model-load`) finish and include the `initial-response` metric.
- Invoke command palette shortcuts and observe hook events that capture keyboard telemetry for regression detection.
- Open and dismiss modals (About, Tool Call Approval) to ensure automation targets register and unregister cleanly without leaking handles.

Capturing screenshots while running this loop provides visual confirmation of UI state changes correlated with the instrumentation stream, accelerating bug triage.

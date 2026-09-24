## Context

The application currently opens documents in reader mode but exposes mode switching only through `Ctrl+E`; the screenshot's toolbar has no visible Edit action. AI controls are disabled without an open workspace because configuration and provider lookup are keyed by workspace path. The outline is a collapsible left panel but starts closed. Base styling has minimal visual hierarchy and no user-facing theme selector. The Tauri backend can consume an OS launch path, but the Windows bundle does not register `.md` associations.

Constraints: preserve ProseMirror as the only owner of editable content, keep Markdown parsing/rendering on the existing core path, retain the round-trip invariant, and keep AI credentials in the OS credential store.

## Goals / Non-Goals

**Goals:**
- Establish a cohesive Obsidian-inspired visual language, dark by default, with dark/light/sepia themes and visible interactive states.
- Make Edit/Read mode changes obvious and the left outline open by default, collapsible from a control beneath the main toolbar.
- Separate device-level provider configuration from workspace-only retrieval; enable selection AI on standalone documents.
- Register Markdown files in Windows bundles and validate launching with an OS-provided path.
- Produce repeatable, recorded measurements for document open/render and large-workspace scan/navigation without regressing UI responsiveness.

**Non-Goals:**
- Replacing the editor, Markdown AST, or rendering pipeline.
- Adding custom CSS/theme authoring, plugins, or changing Markdown serialization.
- Claiming support for `.md` file association on platforms not built and tested by this change.
- Optimizing based on guesses before benchmark measurements identify a bottleneck.

## Decisions

1. **Use app-level theme tokens and a persisted theme preference.** Define semantic colors/surfaces/borders/text/focus tokens and map reader, editor, panels, dialogs, and controls to them. Start with dark; include light and sepia. Appearance is an icon menu at the top right, not a permanent labeled select in the main action row. Alternatives: ad-hoc per-component color classes (rejected because visual drift is already visible) and system-only theme detection (rejected because the user explicitly wants to choose). Keep shared typography sizing/spacing invariants from `docs/architecture.md`.

2. **Keep reader mode as the initial mode but add an explicit Edit/Read control.** The product's reader-first behavior remains, while a labeled, keyboard-accessible control removes reliance on discovering `Ctrl+E`. Alternatives: open every file directly in editor mode (rejected because it changes the reader-first workflow) or rely on the shortcut alone (the current discoverability failure).

3. **Keep the document navigator on the left, open by default, with an icon control at its boundary.** Persist the user's collapsed/open preference. The user-facing UI does not call it “Outline”; an icon at the left-panel edge collapses it toward the left and remains available to reopen it, matching PDF/document viewers. Alternatives: a labeled toolbar-row button (rejected after visual review because it consumes a whole row and reads as an action rather than a panel affordance), moving it right (rejected by the requested placement), or always showing it (rejected for narrow windows).

4. **Make provider/model preferences device-wide; keep RAG workspace-scoped.** Selection operations use the configured device provider for the open document, whether or not its parent folder is an open workspace. Workspace Q&A still requires a workspace for indexing and clearly explains how to open one. Remote data-consent text and OS credential storage continue to apply. Alternatives: implicitly opening the parent folder (rejected because it changes workspace/watch scope) and requiring a workspace for all AI (rejected because it blocks selection commands on standalone files).

5. **Use Tauri's Windows bundle file-association configuration and the existing startup-file path flow.** Validate an installed build launched with a `.md` file, including opening the document in reader mode. Alternatives: custom registry writes in application startup (rejected in favor of installer-managed registration) and shell-only shortcuts (do not satisfy double-click opening).

6. **Measure before performance optimization.** Add repeatable benchmark fixtures/scripts for a representative large Markdown document and a workspace with thousands of entries; record machine, workload, cold/warm timings, UI responsiveness, and observed results. Keep the existing 16 ms criterion for considering a Markdown-core migration. Alternatives: arbitrary hard budgets before a baseline (rejected as likely misleading across hardware) and subjective “feels fast” checks only (rejected because they are not repeatable).

7. **Expose existing Markdown behavior through an icon toolbar with native descriptions.** The editor toolbar includes paragraph/H1–H6, bold, italic, strike, inline code, link, quote, code block with language, bullet/number/task lists, horizontal rule, table, image, undo, and redo. Buttons show active/disabled state and a tooltip containing the action and shortcut where one exists. A help entry lists all shortcuts and the `/` command menu. Alternatives: shortcuts and slash commands only (rejected as undiscoverable) and a ribbon with labeled controls (rejected as visually heavy).

8. **Represent warning callouts as portable GitHub-style Markdown.** A warning is serialized as a blockquote whose first paragraph begins `[!WARNING]`; rendering decorates that recognizable structure. Alternatives: arbitrary colored text via HTML (rejected because it weakens portability and clean diffs) and a new custom AST node (rejected because standard blockquote syntax already round-trips).

The change does not alter parse, mapping, or serialization behavior. Theme state, outline visibility, mode, and provider preferences remain peripheral UI/session settings; Markdown content is still serialized only through the existing core path, preserving the round-trip invariant.

## Risks / Trade-offs

- [Theme token migration can miss isolated hard-coded colors] → Audit all app surfaces and verify reader/editor parity in each theme.
- [Persisted outline state can make the first-run layout confusing on smaller displays] → Keep the collapse control visible and test a narrow window.
- [Moving AI configuration from workspace keys to a device key can strand existing settings] → Offer a one-time migration chooser for conflicting saved configurations; copy any selected secret directly between OS credential-store entries without exposing it to frontend storage.
- [Windows association behavior varies by installer and default-app policy] → Test the packaged installer and report when Windows requires the user to choose Markflow as the default app.
- [Large benchmark fixtures can make routine tests slow] → Separate deterministic correctness tests from opt-in or CI performance measurements and document how to reproduce results.

## Open Questions

- The benchmark report will establish baseline timings first; any hard latency targets should be proposed from those measurements rather than invented in advance.

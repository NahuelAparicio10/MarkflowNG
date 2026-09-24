## 1. Provider settings scope and migration

- [x] 1.1 Inspect current persisted provider configurations and credential-key identities; decide and document migration behavior for zero, one, and conflicting workspace configurations.
- [x] 1.2 Move provider/model preference state to device scope without persisting credentials or logging secrets.
- [x] 1.3 Keep remote consent, loopback validation, and OS credential-store behavior intact under device-level configuration.
- [x] 1.4 Add tests for restoring device settings and migrating legacy workspace settings safely.

## 2. Standalone-document AI workflows

- [x] 2.1 Make provider settings reachable when a standalone Markdown file is open and no workspace is selected.
- [x] 2.2 Wire selection-command availability and generation to device-level provider configuration.
- [x] 2.3 Keep workspace Q&A gated on a workspace and provide an actionable open-folder path when unavailable.
- [x] 2.4 Add tests for standalone selection commands, unconfigured state, and workspace-only retrieval.

## 3. Theme system and visual refinement

- [x] 3.1 Define shared semantic theme tokens and migrate app, reader, editor, explorer, AI panel, and dialogs to them.
- [x] 3.2 Implement persisted Dark (first-launch default), Light, and Sepia theme selection.
- [x] 3.3 Give buttons and controls consistent hover, focus-visible, pressed/selected, and disabled states with accessible contrast.
- [x] 3.4 Add tests for theme default, selection persistence, and representative control states.

## 4. Reader/editor and outline controls

- [x] 4.1 Add a visible, labeled Edit/Read control while preserving the current reader-first opening mode and keyboard shortcut.
- [x] 4.2 Show the document outline on the left by default and add a collapse/reopen control beneath the main toolbar.
- [x] 4.3 Persist outline visibility and ensure the panel collapses toward the left without obscuring document controls.
- [x] 4.4 Add UI tests for mode changes, outline navigation, visibility, and persistence.

## 5. Windows Markdown file association

- [x] 5.1 Configure the Windows Tauri bundle to register `.md` files and retain the existing startup-file route.
- [x] 5.2 Verify startup arguments, reader-mode opening, missing-file messaging, and behavior when a file is opened without a workspace.
- [ ] 5.3 Build and manually test the packaged Windows installer with a `.md` file from Explorer; document default-app selection behavior.
- [x] 5.4 Confirm opening and saving an associated file without edits preserves the Markdown round-trip.

## 6. Performance evaluation

- [x] 6.1 Create reproducible large-document and several-thousand-entry workspace workloads, recording their generation parameters.
- [x] 6.2 Measure cold/warm document open-to-render time and workspace scan completion on a documented Windows machine.
- [x] 6.3 Verify navigation and editing-related UI remain responsive while a large workspace is scanning; identify bottlenecks before optimizing.
- [x] 6.4 Record results, measurement method, limitations, and follow-up thresholds in project documentation.

## 7. Documentation and verification

- [x] 7.1 Update `docs/roadmap.md` and `docs/architecture.md` with completed MVP checks and any evidence-based remaining work.
- [x] 7.2 Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- [x] 7.3 Run `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, and Rust tests.
- [x] 7.4 Run Markdown/editor round-trip tests and verify theme/mode/outline changes do not alter document output.

## 8. Review fixes and editor discoverability

- [x] 8.1 Grant the exact OS-provided startup file to the Tauri fs scope before frontend loading, with tests that reject arbitrary frontend-provided paths.
- [x] 8.2 Restrict legacy credential migration to the fixed device destination and add security-focused tests.
- [x] 8.3 Replace the labeled outline row with an icon at the left navigator boundary and move appearance to an icon menu at the top right.
- [x] 8.4 Rework the application chrome and AI panel hierarchy for a modern, compact editor layout with accessible icon labels and tooltips.
- [x] 8.5 Expand the editor toolbar to expose inline formatting, paragraph/H1–H6, quotes, code language, lists, warning callouts, horizontal rule, table/image, undo and redo.
- [x] 8.6 Add a keyboard-shortcut/help surface and tests for toolbar active, disabled, and command behavior.
- [x] 8.7 Render and round-trip portable `[!WARNING]` callouts without arbitrary HTML colors.

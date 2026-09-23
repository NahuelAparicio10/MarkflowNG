## 1. Session model: single document to tabs

- [ ] 1.1 Reshape `src/store/session.ts` into a collection of open documents with
      one active, each holding path, dirty flag and mode
- [ ] 1.2 Move every consumer written against the single-document assumption to
      read the active document
- [ ] 1.3 Keep the phase 1.5 single-file open path working for documents opened
      outside any workspace
- [ ] 1.4 Do this before any explorer UI, so the rest is built on the final shape

## 2. Rust: workspace scan

- [ ] 2.1 Add a `scan_workspace` command performing the recursive traversal in Rust
      and returning the listing as one payload
- [ ] 2.2 Make the scan asynchronous and emit partial results so the tree fills in
      progressively
- [ ] 2.3 Handle unreadable folders and permission errors with a reported failure
- [ ] 2.4 Decide whether non-Markdown files are listed; resolve the design.md open
      question and implement it

## 3. Rust: filesystem watcher

- [ ] 3.1 Start a watcher on the workspace root using the `watch` feature of
      `tauri-plugin-fs`
- [ ] 3.2 Debounce and coalesce events in the backend before emitting; measure the
      window against a real version control checkout and record the value
- [ ] 3.3 Emit creation, modification, rename and deletion events; treat rename as
      delete plus create where the platform does not report it atomically
- [ ] 3.4 Write a test asserting a bulk change produces a batch, not one event per file

## 4. Self-write tagging

- [ ] 4.1 Record target path and expected content hash before every write in the
      save path
- [ ] 4.2 Match incoming watcher events against recent self-writes and suppress those
- [ ] 4.3 Confirm the watcher is never suspended, paused or unsubscribed around a write
- [ ] 4.4 Write a test: perform an autosave, assert no external-change event reaches
      the frontend
- [ ] 4.5 Write a test: modify a different file during a save, assert it is still
      reported as external

## 5. External change handling

- [ ] 5.1 Reload silently when the affected open document is clean
- [ ] 5.2 Prompt with a keep-local or reload-from-disk choice when it is dirty
- [ ] 5.3 Ensure nothing is written or discarded while a conflict is unanswered
- [ ] 5.4 Handle deletion of an open document by informing the user and retaining
      the in-memory content
- [ ] 5.5 Write tests for the clean, dirty and deleted cases

## 6. Directory tree

- [ ] 6.1 Create `src/explorer/FileTree.tsx` virtualized with `@tanstack/react-virtual`
- [ ] 6.2 Implement folder expand and collapse
- [ ] 6.3 Open a `.md` file on activation
- [ ] 6.4 Apply watcher events to the tree incrementally rather than rescanning
- [ ] 6.5 Write a test asserting only viewport rows are mounted for a large workspace

## 7. Quick open

- [ ] 7.1 Cache the file listing in memory in a workspace store slice
- [ ] 7.2 Create `src/explorer/QuickOpen.tsx` with fuzzy matching and ranking over
      that cache, issuing no backend call per keystroke
- [ ] 7.3 Bind the invoking shortcut
- [ ] 7.4 Refresh the cache from watcher events so the listing stays current
- [ ] 7.5 Write tests for non-contiguous matching, ranking, and cache freshness

## 8. Preview

- [ ] 8.1 Create `src/explorer/Preview.tsx` calling the reader renderer directly
- [ ] 8.2 Confirm no editor instance is created for a preview
- [ ] 8.3 Write a test asserting the preview uses the same renderer as reader mode

## 9. Tabs

- [ ] 9.1 Create `src/ui/TabStrip.tsx` listing open documents with per-tab dirty state
- [ ] 9.2 Give each open document its own editor instance so undo history and caret
      survive tab switches
- [ ] 9.3 Prompt before closing a tab with unsaved changes
- [ ] 9.4 Write tests for undo history and caret preservation across a tab switch

## 10. Verification

- [ ] 10.1 Resolve the design.md open question on persisting the workspace root and
      open tabs across restarts, and implement or explicitly defer it
- [ ] 10.2 Run `npm run lint` and fix all findings
- [ ] 10.3 Run `npm run typecheck` and fix all findings
- [ ] 10.4 Run `npm run test` and confirm green
- [ ] 10.5 Run `cargo clippy` on `src-tauri` and fix all warnings
- [ ] 10.6 Add a Playwright e2e test: open a workspace, navigate the tree, quick
      open a file, edit it, switch tabs and return
- [ ] 10.7 Manually verify against a real documentation folder of several thousand
      files that the tree and quick open stay responsive

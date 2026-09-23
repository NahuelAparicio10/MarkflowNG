## 1. Session model: single document to tabs

- [x] 1.1 Reshape `src/store/session.ts` into a collection of open documents with
      one active, each holding path, dirty flag and mode
- [x] 1.2 Move every consumer written against the single-document assumption to
      read the active document
- [x] 1.3 Keep the phase 1.5 single-file open path working for documents opened
      outside any workspace
- [x] 1.4 Do this before any explorer UI, so the rest is built on the final shape

## 2. Rust: workspace scan

- [x] 2.1 Add a `scan_workspace` command performing the recursive traversal in Rust
      and returning the listing as one payload
- [x] 2.2 Make the scan asynchronous and emit partial results so the tree fills in
      progressively
- [x] 2.3 Handle unreadable folders and permission errors with a reported failure
- [x] 2.4 Decide whether non-Markdown files are listed; resolve the design.md open
      question and implement it

## 3. Rust: filesystem watcher

- [x] 3.1 Start a watcher on the workspace root using the `watch` feature of
      `tauri-plugin-fs`
- [x] 3.2 Debounce and coalesce events in the backend before emitting; measure the
      window against a real version control checkout and record the value
- [x] 3.3 Emit creation, modification, rename and deletion events; treat rename as
      delete plus create where the platform does not report it atomically
- [x] 3.4 Write a test asserting a bulk change produces a batch, not one event per file

## 4. Self-write tagging

- [x] 4.1 Record target path and expected content hash before every write in the
      save path
- [x] 4.2 Match incoming watcher events against recent self-writes and suppress those
- [x] 4.3 Confirm the watcher is never suspended, paused or unsubscribed around a write
- [x] 4.4 Write a test: perform an autosave, assert no external-change event reaches
      the frontend
- [x] 4.5 Write a test: modify a different file during a save, assert it is still
      reported as external

## 5. External change handling

- [x] 5.1 Reload silently when the affected open document is clean
- [x] 5.2 Prompt with a keep-local or reload-from-disk choice when it is dirty
- [x] 5.3 Ensure nothing is written or discarded while a conflict is unanswered
- [x] 5.4 Handle deletion of an open document by informing the user and retaining
      the in-memory content
- [x] 5.5 Write tests for the clean, dirty and deleted cases

## 6. Directory tree

- [x] 6.1 Create `src/explorer/FileTree.tsx` virtualized with `@tanstack/react-virtual`
- [x] 6.2 Implement folder expand and collapse
- [x] 6.3 Open a `.md` file on activation
- [x] 6.4 Apply watcher events to the tree incrementally rather than rescanning
- [x] 6.5 Write a test asserting only viewport rows are mounted for a large workspace

## 7. Quick open

- [x] 7.1 Cache the file listing in memory in a workspace store slice
- [x] 7.2 Create `src/explorer/QuickOpen.tsx` with fuzzy matching and ranking over
      that cache, issuing no backend call per keystroke
- [x] 7.3 Bind the invoking shortcut
- [x] 7.4 Refresh the cache from watcher events so the listing stays current
- [x] 7.5 Write tests for non-contiguous matching, ranking, and cache freshness

## 8. Preview

- [x] 8.1 Create `src/explorer/Preview.tsx` calling the reader renderer directly
- [x] 8.2 Confirm no editor instance is created for a preview
- [x] 8.3 Write a test asserting the preview uses the same renderer as reader mode

## 9. Tabs

- [x] 9.1 Create `src/ui/TabStrip.tsx` listing open documents with per-tab dirty state
- [x] 9.2 Give each open document its own editor instance so undo history and caret
      survive tab switches
- [x] 9.3 Prompt before closing a tab with unsaved changes
- [x] 9.4 Write tests for undo history and caret preservation across a tab switch

## 10. Verification

- [x] 10.1 Resolve the design.md open question on persisting the workspace root and
      open tabs across restarts, and implement or explicitly defer it
- [x] 10.2 Run `npm run lint` and fix all findings
- [x] 10.3 Run `npm run typecheck` and fix all findings
- [x] 10.4 Run `npm run test` and confirm green
- [x] 10.5 Run `cargo clippy` on `src-tauri` and fix all warnings
- [x] 10.6 Add a Playwright e2e test: open a workspace, navigate the tree, quick
      open a file, edit it, switch tabs and return
- [ ] 10.7 Manually verify against a real documentation folder of several thousand
      files that the tree and quick open stay responsive

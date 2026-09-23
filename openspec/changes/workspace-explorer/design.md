## Context

The application currently opens a single file through a dialog and holds one
document. This change makes it operate over a folder.

`Context/EXPLORE.md` is explicit about where this work lives: filesystem
operations that do not touch the active document belong in Rust, because they do
not cross the IPC bridge during editing. Scanning, watching and indexing are named
directly. This is the first change to take that seriously.

Two hard problems appear here for the first time. Concurrency: the file on disk can
now change underneath an open editor. And scale: a documentation folder inside a
game repository can hold thousands of files, and the tree must not stall on it.

## Goals / Non-Goals

**Goals:**
- A workspace root, scanned quickly and asynchronously.
- A tree that stays responsive at thousands of entries.
- Quick open that feels instant.
- Previews that do not mount the editing engine.
- Reliable detection of external changes, with the application never mistaking its
  own writes for someone else's.
- Tabs.

**Non-Goals:**
- Semantic search and embeddings. Phase 7; this change only builds the file listing
  the indexer will later consume.
- Creating, renaming, moving and deleting files from the tree. Useful, but each is
  a destructive operation deserving its own consideration; deferred.
- Git integration. Out of scope for the MVP.
- Multiple workspace roots. One root, matching the single-window constraint.

## Decisions

### D1. Scanning and watching live in Rust; the frontend receives events

The workspace scan is a Rust command returning the file listing. The watcher is a
Rust task emitting events to the frontend.

*Alternatives considered:* doing both from the frontend through the fs plugin's
JavaScript API. Rejected on the reasoning already recorded in `EXPLORE.md`: a
recursive scan of thousands of entries done through IPC means thousands of bridge
crossings, and a JavaScript-side watcher would either poll or marshal every native
event individually. Rust does the traversal and sends one payload.

### D2. The tree is virtualized from the start, not when it becomes slow

Rendering uses `@tanstack/react-virtual`, already a dependency.

*Alternatives considered:* rendering all nodes and optimizing after measuring, per
the project's own "measure before optimizing" rule. Rejected as the exception that
proves the rule: the outcome is not in doubt. A folder with several thousand
entries produces several thousand DOM nodes, and the failure is not a subtle
regression but an unusable window. `EXPLORE.md` already specifies virtualization
for this component.

### D3. Quick open ranks in the frontend over a listing cached from Rust

The file listing is fetched once per scan and held in memory. Fuzzy matching runs
in the frontend against that array.

*Alternatives considered:* sending each keystroke to Rust to filter. Rejected
because it puts an IPC round trip in the typing path of the feature whose entire
value is that it feels instant. The listing is paths only, so even tens of
thousands of entries are a small array.

### D4. Preview renders through the reader, never through a second code path

Selecting a file in the tree parses it and renders it with the phase 1.5 reader.

*Alternatives considered:* a lighter preview renderer producing simplified output.
Rejected explicitly by `EXPLORE.md`: one rendering path. A second renderer would
drift from the first, and the reader is already cheap because it mounts no editor.

### D5. The application tags its own writes so the watcher can ignore them

Before writing, the save path records the target path and the expected content
hash. A watcher event matching a recent self-write is not surfaced as external.

*Alternatives considered:*
- *Suspend the watcher around writes.* Rejected: it races. A genuine external
  change landing in that window is silently missed, which is the failure the
  watcher exists to prevent.
- *Compare modification timestamps.* Rejected: timestamp granularity is coarse
  enough that an external write in the same tick is indistinguishable, and clock
  behavior varies across filesystems.

This matters because autosave writes on a timer, so without it the application
would constantly warn the user about its own edits.

### D6. External changes are handled differently depending on dirty state

If the open document is clean, an external modification reloads it silently. If it
is dirty, the user is told and chooses; nothing is overwritten or discarded
automatically.

*Alternatives considered:*
- *Always prompt.* Rejected: the common case is git checking out a branch or a
  formatter running, where the user has no local edit and a prompt is noise.
- *Always reload.* Rejected: it silently destroys unsaved work.

### D7. Tabs hold one editor instance per open document

Each tab owns its own ProseMirror instance, preserving undo history and caret per
document.

*Alternatives considered:* one editor instance reloaded on tab switch. Rejected
because it discards undo history and caret position on every switch, which for a
tabbed editor is a defect rather than a trade-off. The cost is memory proportional
to open tabs, which is bounded by how many a person actually opens.

### D8. The scan is asynchronous and the tree renders progressively

The window is usable while the scan runs.

*Alternatives considered:* blocking on the scan before showing the tree. Rejected
because opening a large folder would then appear to hang.

## Risks / Trade-offs

- **Watcher events arrive in bursts, for example during a git checkout touching
  hundreds of files** → Events are debounced and coalesced on the Rust side before
  being emitted, so the frontend receives one batch rather than hundreds of messages.
- **Self-write tagging has a gap and the user sees spurious external-change warnings**
  → Mitigated by hashing content rather than relying on timing, and by a test that
  performs an autosave and asserts no external-change event reaches the frontend.
- **Watcher behavior differs across platforms, notably for renames** → Windows is
  the target and is what gets tested. Rename is treated as delete plus create where
  the platform does not report it atomically.
- **Memory grows with many open tabs, since each holds a full editor** → Accepted
  per D7. Revisit only if it proves real, per the project rule on measuring.
- **Tabs invalidate the single-document assumption throughout the codebase** →
  Largest refactor risk in the change. Mitigated by doing the session model change
  first, before the explorer UI, so the rest is built on the final shape.

## Migration Plan

The session model changes from one open document to a collection with an active
one. Consumers written against the single-document store must move to reading the
active document. No persisted data exists, so this is a code refactor. The
single-file open path from phase 1.5 remains available for documents opened outside
any workspace.

## Open Questions

- Should the workspace root persist across restarts and reopen automatically?
  Probably yes, along with the open tabs; needs a small settings-persistence
  mechanism that does not exist yet.
- Should non-Markdown files appear in the tree? Leaning toward showing them greyed
  out, so the tree reflects the real folder, with only `.md` files openable.
- What is the debounce window for coalescing watcher events? To be measured against
  a real git checkout.

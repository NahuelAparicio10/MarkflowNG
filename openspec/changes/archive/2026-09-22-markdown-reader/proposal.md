## Why

The reader is not a preview pane bolted onto an editor: `Context/EXPLORE.md`
states that opening a `.md` and reading it formatted, fast, without entering edit
mode, is a first-class function of the product. It is also the cheapest useful
thing that can be built, because rendering mdast to React is a pure function that
needs no ProseMirror, no caret, no transactions and no undo.

Building it now yields a shippable product one phase after the core lands, and it
proves the core mapping against real documents long before the editor exists.
Corresponds to **Fase 1.5** of `Context/EXPLORE.md`.

## What Changes

- Add `src/reader/` with a pure mdast-to-React renderer covering every node type
  the core parser can produce, including those the ProseMirror schema does not yet
  support.
- Add a shared typographic stylesheet used by both the reader and, later, the
  editor, so switching modes causes no visual jump.
- Add a document outline derived from headings, with click-to-scroll navigation
  and active-section tracking.
- Add a raw Markdown view as a third mode, for inspecting the actual file on disk.
- Add file opening through the Tauri dialog and fs plugins, plus a
  `--` file-argument path so the OS can hand a `.md` to the app.
- Add mode switching between reader, raw and (later) editor via keyboard shortcut.
- Add Zustand store slices for the open document, the active mode and the outline.

## Capabilities

### New Capabilities
- `document-reader`: rendering a parsed Markdown document as formatted, readable
  output, including the outline, the raw view and switching between view modes.
- `document-session`: opening a file from disk or from an OS file association,
  and holding which document and which mode are currently active.

### Modified Capabilities

_None. `markdown-core` is consumed as-is; the reader adds no requirements to it._

## Impact

- New code: `src/reader/`, `src/store/`, `src/ui/` layout shell, reader stylesheet.
- Depends on `markdown-core` being complete: the reader renders mdast, so it
  cannot start before `parseMarkdown` exists.
- Uses `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`, already installed
  and registered in `src-tauri/src/lib.rs`.
- First user-visible functionality. The placeholder app shell is replaced.
- The shared stylesheet becomes a constraint on phase 2: the editor must adopt it
  rather than define its own typography.

## Why

With the core round-trip closed and the reader shipping, the product still cannot
do the thing it exists for: write. This change mounts Tiptap on the core schema
and closes the loop from disk to editor to disk, proving on real files that
opening a document, editing it and saving it produces exactly the Markdown the
user expects and nothing else.

It is deliberately narrow: paragraphs and headings only, the same node set the
core already guarantees. Formatting marks arrive next. The point of this phase is
the plumbing, not the feature surface. Corresponds to **Fase 2** of
`Context/EXPLORE.md`.

## What Changes

- Add `src/editor/` mounting `@tiptap/react` on the schema from `src/core/schema/`
  rather than on Tiptap's default StarterKit schema.
- Wire loading: parse a file, map mdast to a ProseMirror document, hydrate the editor.
- Wire saving: read the editor document, map to mdast, serialize, write to disk.
- Add a dirty-state indicator and autosave with debounce.
- Move ownership of editable document content out of the Zustand session slice and
  into ProseMirror, leaving only path, dirty flag and mode in the store, as
  committed to in the `document-session` capability.
- Make the `editor` view mode reachable, completing the mode state machine.
- Add end-to-end round-trip verification against real files: open, save without
  editing, assert the bytes on disk are unchanged.
- Add undo and redo, and the standard save shortcut.

## Capabilities

### New Capabilities
- `document-editing`: mounting the editing engine on the core schema, hydrating it
  from a file, applying edits, and undo/redo.
- `document-persistence`: saving a document back to Markdown on disk, autosave,
  dirty tracking, and the guarantee that an untouched document saves byte-identically.

### Modified Capabilities

_None. The `document-session` capability already specifies that ownership of
editable content moves to ProseMirror when the editor is introduced and already
declares the `editor` mode; this change satisfies those requirements rather than
altering them._

## Impact

- New code: `src/editor/`, save path in `src/store/`.
- Modified: `src/store/session.ts` loses the document tree for editable documents;
  `src/App.tsx` gains the editor mode branch.
- Depends on `markdown-core-roundtrip` and `markdown-reader`.
- The reader keeps rendering from mdast; this change adds a second consumer of the
  core, and with it the risk that the two render differently. A parity test is
  included to catch that.
- Autosave writing to disk is the first destructive operation in the product. The
  round-trip guarantee is what makes it safe, which is why it is verified
  end-to-end here rather than assumed from the unit tests.

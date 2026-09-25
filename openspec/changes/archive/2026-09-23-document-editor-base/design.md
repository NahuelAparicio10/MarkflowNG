## Context

`markdown-core` owns the schema and the mapping. `markdown-reader` owns rendering
and the session. This change introduces the editing engine and the write path.

The critical property to preserve is the one the whole project rests on: a file
opened and saved without edits must produce an empty git diff. Unit tests assert
this at the mdast level; this change is where it is first exercised against the
real filesystem, with autosave firing on a timer.

## Goals / Non-Goals

**Goals:**
- Tiptap mounted on the project schema, not on Tiptap defaults.
- Load and save paths that go through the core and nothing else.
- Undo and redo that behave as a single coherent history.
- Autosave that cannot corrupt a file.
- Session state cleaned up so ProseMirror is the sole owner of editable content.
- End-to-end proof of the round-trip against real files.

**Non-Goals:**
- Formatting marks, lists, code blocks, links. Phase 3.
- Tables and images. Phase 5.
- Input rules and slash commands. Phases 3 and 6.
- Multiple open documents and tabs. Deferred to the explorer phase.

## Decisions

### D1. Tiptap is configured with the core schema, not StarterKit

Extensions are declared explicitly, and their node specs come from
`src/core/schema/`. `@tiptap/starter-kit` is not used as the schema source.

*Alternatives considered:* using StarterKit and mapping between its schema and
the core schema. Rejected because it creates two schemas that must agree, which is
the exact failure mode `markdown-core` was built to prevent. StarterKit is a
convenience bundle whose node set is chosen for generic rich text, not for what
remark can round-trip. Where a StarterKit extension happens to match the core
schema it can be configured to use the core node spec; where it does not, it is
not installed. The installed `@tiptap/starter-kit` dependency remains available
for its non-schema extensions such as history.

### D2. Load goes file to mdast to ProseMirror; save goes the reverse; no shortcuts

There is exactly one load path and one save path, both through `src/core/`.

*Alternatives considered:* a fast path that writes the raw text back when the
document is unmodified, skipping serialization. Rejected: it would make the
common case pass while leaving the real serialization path untested, which is
precisely backwards. If saving an untouched document does not reproduce it byte
for byte, that is a bug to fix in the mapping, not to route around.

### D3. Autosave is debounced, writes atomically, and never fires on a failed serialization

Autosave triggers after a debounce interval of inactivity. The write goes to a
temporary file in the same directory and is then renamed over the target. If
serialization throws, nothing is written and the user is told.

*Alternatives considered:*
- *Write directly to the target file.* Rejected: a crash or power loss mid-write
  truncates the user's document. Same-directory rename is atomic on the platforms
  targeted, and the temporary file must be in the same directory or the rename
  degrades to a copy across filesystems.
- *Save on every transaction.* Rejected: writes on every keystroke, and produces
  a useless flood of filesystem watcher events in phase 4.
- *No autosave, explicit save only.* Rejected: EXPLORE.md lists autosave in the
  MVP, and a document editor that loses work on crash fails the basic contract.

### D4. Ownership of editable content moves to ProseMirror in this change

The Zustand session slice keeps path, dirty flag and mode. The document tree for
an *open editable* document is no longer stored there.

*Alternatives considered:* keeping the tree in the store and syncing it from
ProseMirror on every transaction. Rejected explicitly by the project invariant:
it breaks undo, desynchronizes the caret and destroys performance on long
documents. The reader continues to hold a tree for read-only display, which is
sound because a read-only tree has no caret to desynchronize; the moment a
document becomes editable the store drops it.

### D5. Undo history belongs to ProseMirror, and save is not an undo boundary

The history extension owns undo and redo. Saving does not create a history entry
and does not clear history.

*Alternatives considered:* clearing history on save, as some editors do. Rejected
because with autosave that would erase the user's undo stack at arbitrary moments,
which is actively hostile.

### D6. Reader and editor parity is asserted by test, not by inspection

A test renders the same fixture through the reader and through the editor and
asserts the resulting text content is equivalent.

*Alternatives considered:* relying on the shared stylesheet and manual review.
Rejected because the two now render from different representations, mdast and
ProseMirror, so they can diverge structurally, not just visually. The shared
stylesheet addresses appearance; only a test addresses content.

### D7. The dirty flag is derived from the document, not from keystrokes

Dirty means the current ProseMirror document does not serialize to the bytes last
written to disk.

*Alternatives considered:* setting a flag on every transaction. Rejected because
typing a character and deleting it would leave the document permanently marked
dirty, and autosave would then rewrite an unchanged file, producing spurious
watcher events and git noise in phase 4.

## Risks / Trade-offs

- **Autosave writes a normalized version of a file the user never edited, producing
  a large unexpected diff** → Real consequence of the pinned stringify options.
  Mitigated by D7: an unedited document is never dirty, so autosave never fires on
  it. Normalization only happens when the user actually edits, at which point a
  diff is expected.
- **The editor schema and the reader diverge as node types are added in later
  phases** → Mitigated by D6, and the parity test grows with each phase.
- **Debounce interval is wrong: too short causes write churn, too long risks losing
  work** → Start conservative, and make explicit save always available and
  immediate. The interval is a constant in one place, tunable without redesign.
- **Atomic rename behaves differently across platforms** → Windows is the initial
  target and same-directory rename is atomic there. The behavior is asserted by
  an integration test rather than assumed, and revisited when Linux is validated.

## Migration Plan

The session store changes shape: consumers reading the document tree for an
editable document must move to reading from the editor instance. Since there are
no users and no persisted state, this is a code refactor within the same change,
not a data migration. The reader's read-only path is unaffected.

## Open Questions

- What debounce interval? Likely in the range of one to a few seconds; to be
  settled by feel during implementation and recorded as a named constant.
- Should saving be blocked while a serialization error is outstanding, or should
  the user be offered the raw view to recover the content? Leaning toward offering
  the raw view, since the content is never lost from memory.

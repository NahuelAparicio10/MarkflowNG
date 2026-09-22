## Context

`markdown-core` provides `parseMarkdown` and a mapping to ProseMirror. The reader
consumes only the first half of that: mdast in, React out. It never touches the
ProseMirror side, which is what makes it cheap and fast.

Two constraints shape the design. First, the reader must render node types the
ProseMirror schema does not support yet, because a user opening a document with
tables in phase 1.5 expects to see a table, not an inert placeholder. Second, the
reader and the editor must look identical, or the mode switch reads as a bug.

## Goals / Non-Goals

**Goals:**
- A pure, side-effect-free `renderMdast(tree): ReactNode`.
- Full node coverage for reading, ahead of editing support.
- Typography shared with the future editor by construction, not by convention.
- An outline that tracks scroll position.
- A raw view showing the exact bytes on disk.
- Opening a file both from inside the app and from the operating system.

**Non-Goals:**
- Editing anything. No caret, no selection handling, no ProseMirror.
- The file tree, quick open and the watcher. Those are the explorer, phase 4.
- Syntax highlighting inside code blocks. Rendered as plain preformatted text for
  now; highlighting is additive and can land any time after.
- Virtualized rendering of very long documents. Measure first, per the project
  rule on optimization.

## Decisions

### D1. The reader renders mdast directly, not the ProseMirror document

`renderMdast` takes the tree from `parseMarkdown` and returns React elements.

*Alternatives considered:* rendering the ProseMirror document in a read-only
editor instance. Rejected on two grounds. It would mount the whole editing engine
to display static text, which is exactly the cost EXPLORE.md wants to avoid when
jumping between files in the explorer. And it would cap the reader at whatever the
schema currently supports, so a table would display as a placeholder in phase 1.5
instead of as a table.

### D2. Node coverage is decoupled from schema coverage

The renderer handles every mdast type remark can produce, including tables, code
blocks, images and footnotes, from this change onward.

*Alternatives considered:* keeping the reader in lockstep with the schema and
growing both together. Rejected because it gives the user a worse experience for
no engineering benefit: rendering a table to React is a dozen lines and carries
none of the round-trip risk that makes tables hard to *edit*. Reading is easy;
editing is what is phased.

### D3. One typographic stylesheet, imported by both modes

Typography lives in a single stylesheet consumed by the reader now and by the
editor in phase 2. Neither defines its own font sizes, spacing or heading scale.

*Alternatives considered:* letting each mode style itself and keeping them
visually aligned by review. Rejected because EXPLORE.md names this exact risk, and
because drift is invisible until someone toggles modes on a document that happens
to expose it. A shared file makes divergence impossible rather than merely
discouraged.

### D4. Three modes as one state machine, not two booleans

The active mode is a single value: `reader`, `raw` or `editor`. The editor arm is
declared now and left unimplemented until phase 2.

*Alternatives considered:* an `isEditing` boolean plus an `isRawView` boolean.
Rejected because it admits the meaningless state where both are true, and every
consumer then has to decide what that means. Declaring the editor arm early also
means phase 2 adds a case rather than reshaping the state.

### D5. Document state in Zustand, but only because there is no editor yet

The open document lives in a Zustand slice during this phase. When phase 2 lands,
ownership of the *editable* document moves to ProseMirror, and the slice retains
only the file path, dirty flag and mode.

*Alternatives considered:* putting the parsed tree in React component state.
Rejected because the outline, the raw view and the title bar all need it, and
prop-drilling it through the layout is worse than a slice. This is explicitly not
a violation of the project invariant, which governs the *editable* document; a
read-only tree has no caret to desynchronize. The handover is called out here so
phase 2 does not inherit a duplicate source of truth by accident.

### D6. Outline tracking uses IntersectionObserver

Headings are observed and the outline highlights the topmost visible one.

*Alternatives considered:* a scroll listener computing offsets. Rejected as it
runs work on every scroll frame for a result the platform already computes.

### D7. File association is wired in Rust, surfaced as an event

The OS passes the file path as a process argument. The Rust side reads it on
startup and emits it to the frontend, which opens it in reader mode.

*Alternatives considered:* having the frontend read `process.argv`. Not available
in a webview; the argument only exists on the Rust side. Registering the file
association in the bundle configuration is deferred to whenever installers are
first produced, since it only takes effect for installed builds.

## Risks / Trade-offs

- **Reader and editor typography drift anyway, because the editor needs
  editing-specific styles** → Mitigated by scoping the shared file to typography
  only (font, size, weight, spacing, heading scale, list indentation) and keeping
  caret, selection and toolbar styling in editor-local CSS.
- **Rendering a very large document blocks the main thread** → Accepted for now
  and measured rather than pre-optimized, per the EXPLORE.md rule. The 16 ms
  threshold defined for the core applies here too; virtualization is the fallback
  if it is crossed.
- **The reader silently diverges from what the editor would produce, because they
  render from different representations (mdast versus ProseMirror)** → Real risk.
  Mitigated in phase 2 by a test asserting that a document rendered by the reader
  and the same document rendered by the editor produce equivalent text content.
- **Raw view and disk drift once autosave exists** → The raw view must serialize
  from the current tree rather than re-read the file, and label clearly that it
  shows the document as it *would be* written. Settled here so phase 2 does not
  have to reopen it.

## Migration Plan

Additive. The placeholder `App.tsx` shell is replaced by the reader layout. No
persisted data exists to migrate.

## Open Questions

- Should the outline be a persistent side panel or a toggle? Leaning toggle, to
  keep the reading column centered on narrow windows.
- Does the raw view need to be editable as a plain textarea escape hatch? Deferred;
  it conflicts with "never see Markdown syntax" as a default but may be a useful
  power-user affordance.

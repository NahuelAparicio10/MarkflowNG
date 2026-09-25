## Why

After phase 2 the product can open, edit and save a document, but the only things
it can express are paragraphs and headings. Everything a real document needs —
emphasis, links, lists, quotes, code — still passes through the preservation path
as inert blocks. This change makes that content editable.

It is also where the mapping registry earns its keep: each element added here is a
handler pair plus fixtures, with no change to the mapping core. Corresponds to
**Fase 3** of `Context/EXPLORE.md`.

## What Changes

- Extend the ProseMirror schema with the marks `strong`, `emphasis`, `strikethrough`,
  `inlineCode` and `link`.
- Extend the schema with the block nodes `bulletList`, `orderedList`, `listItem`,
  `taskList` item state, `blockquote`, `codeBlock` (with language) and
  `thematicBreak`.
- Register the corresponding mdast handler pairs for every one of them.
- Add keyboard shortcuts for the marks, matching platform conventions.
- Add input rules so typing Markdown syntax produces formatted content: `# ` for a
  heading, `**text**` for bold, `- ` for a list item, `> ` for a quote, ``` for a
  code fence, `---` for a horizontal rule, and the rest of the set.
- Add a link editing affordance, since links cannot be created by typing alone.
- Extend the round-trip fixture corpus and the reader-editor parity corpus for
  every new element.

## Capabilities

### New Capabilities
- `text-formatting`: inline marks and their application through shortcuts and
  input rules.
- `block-structure`: lists, task lists, quotes, code blocks and horizontal rules,
  as editable block-level content.

### Modified Capabilities
- `markdown-core`: the schema and the mapping registry grow to cover marks and the
  new block node types, and the round-trip guarantee extends to them.

## Impact

- Modified: `src/core/schema/`, `src/core/mapping/handlers/`, `src/core/fixtures/`.
- New code: `src/editor/inputRules/`, `src/editor/shortcuts.ts`, link UI in `src/ui/`.
- Content that previously survived only via the preservation path becomes fully
  editable. The preservation path remains for tables, images and frontmatter until
  phase 5.
- This is the largest single expansion of the mapping surface. Each element is
  independently testable, so the change can land incrementally.
- Input rules interact with undo: converting `# ` into a heading must be a single
  undoable step, or typing feels broken.

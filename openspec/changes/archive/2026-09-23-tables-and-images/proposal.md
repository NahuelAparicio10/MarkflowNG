## Why

Tables and images are the two elements `Context/EXPLORE.md` deliberately holds
until last, because they tension the mapping harder than anything else. A table is
a rigid nested structure where ProseMirror and mdast disagree about shape, and an
image carries a binary asset that has to exist somewhere on disk relative to the
document. Both are also the elements with the most interaction surface: cell
selection, row and column operations, resizing, drag and drop.

They arrive now, on a mature mapping with a proven fixture corpus, rather than
early on an unstable one. For the intended use case — balance tables and diagrams
in game documentation — they are also the elements that make the product actually
usable. Corresponds to **Fase 5** of `Context/EXPLORE.md`.

## What Changes

- Add table nodes to the schema: table, row, header cell and cell, with column
  alignment.
- Add the table handler pair, mapping between the mdast table shape and the
  ProseMirror table shape.
- Add table editing: insert, add and remove rows and columns, select cells, set
  column alignment, resize columns.
- Add the image node with source, alt text and title.
- Add image insertion by dialog, by paste and by drag and drop onto the document.
- Add image path handling relative to the document, so a moved document keeps
  working and the Markdown stays portable.
- Add display resizing for images that does not corrupt the Markdown.
- Extend the fixture corpus and the parity corpus for both.
- Remove tables and images from the preservation fallback, which then covers only
  frontmatter and genuinely unknown constructs.

## Capabilities

### New Capabilities
- `tables`: table structure, editing operations, alignment and round-tripping.
- `images`: inserting, referencing, displaying and round-tripping images, including
  how paths are resolved and stored.

### Modified Capabilities
- `markdown-core`: the schema and mapping registry gain table and image node types,
  and the round-trip guarantee extends to them.

## Impact

- Modified: `src/core/schema/`, `src/core/mapping/handlers/`, `src/core/fixtures/`.
- New code: table extension and UI in `src/editor/` and `src/ui/`, image handling
  including drag and drop.
- Depends on `inline-block-formatting` for a mature mapping, and benefits from
  `workspace-explorer` because relative image paths are best resolved against a
  workspace root.
- The preservation fallback narrows. Frontmatter continues to rely on it.
- Image display size has no representation in Markdown, which forces an explicit
  decision about what resizing means. Recorded in the design.

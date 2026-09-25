## Context

The mapping registry has survived one large expansion. This change is the harder
one, for reasons specific to each element.

Tables: mdast models a table as a list of rows where the first row is implicitly
the header and alignment lives on the table node as a per-column array.
ProseMirror's table model, as implemented by `prosemirror-tables`, uses distinct
header cell and body cell node types with per-cell attributes including colspan and
rowspan. The two models are not isomorphic. GFM tables cannot express merged cells
at all, so the ProseMirror model is strictly more expressive than the format it
must serialize to.

Images: Markdown stores a path, not an image. Whether that path is relative or
absolute, and what it is relative to, determines whether the document works when
opened from a different directory or committed to a repository. Markdown also has
no way to express display size.

## Goals / Non-Goals

**Goals:**
- Tables that are editable with the operations people expect, and that round-trip.
- Alignment preserved in both directions.
- Images inserted by dialog, paste and drag and drop.
- Image paths that stay portable inside a repository.
- Resizing that does not corrupt the Markdown.
- Preservation narrowed to only what genuinely needs it.

**Non-Goals:**
- Merged cells. GFM cannot represent them; see D2.
- Nested tables. Not expressible in GFM.
- Image editing beyond display size.
- An asset manager. Copying a pasted image into the workspace is in scope;
  organizing, deduplicating or cleaning up assets is not.

## Decisions

### D1. Use `prosemirror-tables` rather than a hand-rolled table implementation

`prosemirror-tables` ships with the `@tiptap/pm` dependency already installed.

*Alternatives considered:* modelling tables as plain nested nodes and implementing
the operations directly. Rejected for the same reason the project uses ProseMirror
at all: cell selection, column resizing and correct behavior when rows and columns
are added and removed are genuinely hard, and a solved problem. The cost is that
its model is richer than GFM, which D2 addresses.

### D2. Merged cells are prevented, not silently flattened

The schema constrains colspan and rowspan to 1, and the merge commands are not
exposed.

*Alternatives considered:*
- *Allow merging and flatten on save.* Rejected outright. It means the user builds
  a table, saves, reopens and finds a different table. Silent data loss, which the
  preservation decision in `markdown-core` exists specifically to prevent.
- *Allow merging and preserve via an HTML table on save.* Rejected: it abandons
  clean Markdown, which is the product's entire premise, and the resulting file is
  no longer a GFM table for any other tool.

Preventing the operation is honest. The user cannot reach a state the format cannot
hold.

### D3. Alignment lives on the table node, mirroring mdast

Column alignment is a per-column array on the table node, matching the mdast shape,
and is projected onto cells for rendering.

*Alternatives considered:* storing alignment per cell, which is closer to how
`prosemirror-tables` naturally works. Rejected because it admits the state where
cells in one column disagree, which GFM cannot express, so the serializer would
have to pick a winner. Making the column the owner means the invalid state does not
exist.

### D4. The first row is always the header row

Matching GFM, which has no table without a header.

*Alternatives considered:* an optional header, as in HTML tables. Rejected because
serializing a headerless table to GFM requires either inventing a header or
emitting something that is not a table.

### D5. Image paths are stored relative to the document, when possible

A path inside the workspace is stored relative to the document's own directory.
Paths outside the workspace, and absolute URLs, are stored as given.

*Alternatives considered:*
- *Store absolute paths.* Rejected: the document breaks for every other person who
  clones the repository, and for the same person on another machine.
- *Store relative to the workspace root.* Rejected: the reference then breaks when
  the document is moved within the workspace, and it does not match how Markdown
  references are conventionally written or how other tools resolve them.

### D6. Pasted and dropped image data is written into the workspace beside the document

Binary image data arriving by paste or drag and drop is written to an assets
directory relative to the document, and the Markdown references that file.

*Alternatives considered:*
- *Embed as a base64 data URI.* Rejected: it produces enormous unreadable lines in
  a file whose whole point is a clean git diff.
- *Refuse and require the user to save the file first.* Rejected: pasting a
  screenshot into documentation is a primary use case for this product.

### D7. Display size is stored in the image title field, and only when set

Markdown has no size attribute. When the user resizes an image, the dimensions are
encoded in the image title, which GFM does carry, and which degrades to a harmless
tooltip in other renderers. An image never resized carries no title addition.

*Alternatives considered:*
- *Store size in a sidecar file or frontmatter.* Rejected: the reference and its
  size become separable, and moving the image breaks the association.
- *Emit an HTML `<img>` tag with width.* Rejected: abandons clean Markdown for a
  cosmetic property.
- *Do not support resizing.* A defensible option, and the fallback if the title
  encoding proves ugly in practice. Rejected for now because `EXPLORE.md` lists
  image resizing in the MVP, and because an oversized screenshot in a document is a
  real problem.

This is the weakest decision in the change and is flagged as such. It is
deliberately confined to the title field so that abandoning it later changes one
handler and no stored structure.

### D8. Preservation narrows but does not disappear

The unhandled-node fallback stays, now covering frontmatter, raw HTML and future
Markdown extensions.

*Alternatives considered:* removing it once tables and images are handled. Rejected:
it is the safety net for everything the schema will never cover, and remark can
produce nodes this project has not anticipated.

## Risks / Trade-offs

- **The mdast and ProseMirror table models diverge in a case not covered by
  fixtures, and a table is corrupted on save** → The highest-consequence risk in
  the project. Mitigated by fixtures covering empty cells, cells containing inline
  marks and links, single-column and single-row tables, ragged rows, every
  alignment combination, and tables with pipes and escapes in cell content.
- **Ragged tables, where rows have differing cell counts, are valid in mdast but
  not in the ProseMirror model** → Normalized on load by padding short rows with
  empty cells, and the normalization is asserted by a fixture so the behavior is
  intentional and visible rather than incidental.
- **The title-field size encoding is ugly in the resulting Markdown** → Confined to
  one handler by D7 so it can be withdrawn cheaply. Reassess against real documents
  before considering the change complete.
- **Writing pasted images into the workspace creates files the user did not
  explicitly ask for** → Mitigated by using a predictable assets directory relative
  to the document and by telling the user where the file was written.
- **Column resizing has no Markdown representation at all** → Column widths are
  treated as view state, not document state, and are not persisted. Unlike image
  size, this loses nothing meaningful: a Markdown table has no width.

## Migration Plan

Documents that previously carried tables and images through the preservation path
open with them editable. Nothing on disk changes until the user edits and saves.
Image paths in existing documents are read as written; the relative-path rule in D5
applies to newly inserted images and does not rewrite existing references.

## Open Questions

- ~~What is the assets directory name and layout for pasted images?~~ **Resolved
  during implementation:** a single `assets/` directory next to the document,
  shared by every document in that directory, with files named
  `image-YYYYMMDD-HHMMSS.<ext>` and a `-2`, `-3`… suffix rather than ever
  overwriting. The name sorts chronologically and reads clearly in a diff, and
  no name has to be chosen mid-paste. See `src/images/assets.ts`.
- Should a table with merged cells encountered in an HTML block be surfaced as
  read-only preserved content rather than converted? **Yes, and it already is:**
  raw HTML has no handler, so it travels through the D8 fallback untouched.
- ~~Is the title-field size encoding acceptable in practice?~~ **Reviewed against
  real output (task 8.1); kept, provisionally.** A resized image serializes as
  `![Boss arena](assets/arena.png "width=640")`, or
  `![Diagram](a.png "Build pipeline | width=480")` when it already had a title.
  That is short, readable in a diff, and shows as a harmless tooltip on GitHub
  and in other renderers. The encoding is strict (one exact separator, no
  leading zeros) so decode and re-encode is the identity on every title it
  accepts, and near misses such as `"Caption |width=320"` pass through as
  foreign titles. Withdrawing it still only touches `src/core/images/titleSize.ts`
  and the image handler.

## Implementation Notes

- **Header cells in a one-to-one registry.** mdast has no header cell type, and
  the registry forbids two pairs sharing an mdast type. The `tableHeader` pair is
  registered under the key `tableHeaderCell`, which remark never produces, so it
  is reachable only backwards; header cells are built forwards by the table
  handler, which knows the row index. No file in the mapping core changed.
- **Cells are textblocks** (`inline*`), not containers of paragraphs, because a
  GFM cell holds one line of phrasing content. Enter in a cell moves down the
  column instead of splitting the cell, Tab moves to the next cell and adds a row
  from the last one, and the first row can be neither deleted nor preceded.
- **Ragged rows and the structural invariant.** remark-stringify itself pads short
  rows, so no editor round trip could reproduce a ragged table's first parse. The
  fixture manifest gained `serializerNormalizes`; for such fixtures the structural
  invariant is measured against remark's own round trip, and a dedicated test
  asserts the padded result.
- **Displaying local images.** Local references are read through the fs plugin
  and shown as blob URLs, which keeps them inside the scope the user already
  granted and works against the e2e suite's in-memory file system. A document
  opened on its own only grants its own file, so on open the backend widens the
  scope to that document's directory (`allow_document_directory`), refusing any
  path not already in scope.
- **OS file drops** reach the app through Tauri's drag-drop event rather than the
  DOM, carry real paths, and are referenced per D5 rather than copied. Only data
  without a path (paste, a drag from a browser) is written into `assets/`.

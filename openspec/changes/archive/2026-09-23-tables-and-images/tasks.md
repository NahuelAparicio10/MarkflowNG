## 1. Table schema and mapping

- [x] 1.1 Add table, table row, header cell and cell node specs, built on
      `prosemirror-tables` from the installed `@tiptap/pm`
- [x] 1.2 Constrain colspan and rowspan to 1 in the schema so merged cells are
      unreachable
- [x] 1.3 Store column alignment as a per-column array on the table node, mirroring
      mdast; do not store it per cell
- [x] 1.4 Create the table handler pair in its own module under
      `src/core/mapping/handlers/`
- [x] 1.5 Implement ragged-row normalization on load, padding short rows with empty
      cells
- [x] 1.6 Confirm no file under `src/core/mapping/` outside the handlers and the
      composition entry point was modified

## 2. Table fixtures

- [x] 2.1 Add fixtures: empty cells, cells with inline marks and links, single
      column, single row, ragged rows
- [x] 2.2 Add fixtures for every alignment combination including default
- [x] 2.3 Add fixtures for cell content containing pipe characters and escapes
- [x] 2.4 Confirm both round-trip invariants hold over all of them

## 3. Table editing

- [x] 3.1 Register the table extension and expose insert table
- [x] 3.2 Implement insert and delete row, insert and delete column
- [x] 3.3 Remove the table when its last column or last body row is deleted, rather
      than leaving an invalid structure
- [x] 3.4 Implement cell selection and Tab navigation between cells
- [x] 3.5 Implement column alignment controls
- [x] 3.6 Implement column resizing as view state only, not persisted
- [x] 3.7 Confirm no merge operation is reachable from the UI
- [x] 3.8 Write a test asserting a resized-column document serializes unchanged

## 4. Image schema and mapping

- [x] 4.1 Add the image node spec with source, alt and title attributes
- [x] 4.2 Create the image handler pair in its own module
- [x] 4.3 Implement the title-field size encoding, applied only when the user has
      resized, and preserving foreign titles unchanged
- [x] 4.4 Add fixtures: relative paths, absolute URLs, with and without alt text,
      and a foreign title written by another tool

## 5. Image display and insertion

- [x] 5.1 Render images in both reader and editor, with a placeholder for missing files
- [x] 5.2 Implement insertion by file dialog
- [x] 5.3 Implement drag and drop insertion at the drop position
- [x] 5.4 Implement paste insertion, writing clipboard image data to the assets
      directory relative to the document and telling the user where it went
- [x] 5.5 Resolve the design.md open question on the assets directory name and layout
- [x] 5.6 Implement alt text editing
- [x] 5.7 Implement display resizing

## 6. Image path resolution

- [x] 6.1 Store paths relative to the document directory for targets inside the workspace
- [x] 6.2 Store absolute URLs and out-of-workspace paths as given
- [x] 6.3 Never rewrite existing references on open or save
- [x] 6.4 Write a test asserting a cloned workspace still resolves relative references
- [x] 6.5 Write a test asserting an open-and-save cycle leaves every reference
      byte-identical

## 7. Preservation and parity

- [x] 7.1 Confirm the unhandled-node fallback is still registered and that
      frontmatter and unknown constructs still survive an edit-and-save cycle
- [x] 7.2 Extend the reader-and-editor parity corpus with tables and images
- [x] 7.3 Extend the reader renderer where these elements revealed a gap

## 8. Verification

- [x] 8.1 Review real serialized output containing a resized image and decide
      whether the title-field encoding is acceptable or resizing should be dropped;
      record the decision
- [x] 8.2 Run the round-trip suite and confirm both invariants hold
- [x] 8.3 Run `npm run lint` and fix all findings
- [x] 8.4 Run `npm run typecheck` and fix all findings
- [x] 8.5 Run `npm run test` and confirm green
- [x] 8.6 Add a Playwright e2e test: insert a table, add and remove rows and columns,
      set alignment, insert an image by drag and drop, save and reopen
- [ ] 8.7 Manually verify against a real balance table document that editing and
      saving produces a clean, readable diff

## 1. Editor mounting

- [x] 1.1 Create `src/editor/extensions.ts` declaring Tiptap extensions built on the
      node specs from `src/core/schema/`, installing only history and the document,
      paragraph, heading and text nodes
- [x] 1.2 Confirm no StarterKit default node schema is registered, and document why
      in a comment referencing design decision D1
- [x] 1.3 Create `src/editor/EditorView.tsx` mounting `useEditor` with those
      extensions and the `.markflow-prose` class from the shared stylesheet
- [x] 1.4 Render the `preserved` node as a non-editable atom block
- [x] 1.5 Write a test asserting the mounted schema node types equal the core ones

## 2. Load path

- [x] 2.1 Implement `src/editor/loadDocument.ts`: read file, `parseMarkdown`,
      `mdastToPm`, hydrate the editor
- [x] 2.2 Make editor mode reachable from the mode switch
- [x] 2.3 Write a test asserting the load path calls the core functions and builds
      the document by no other route

## 3. Save path

- [x] 3.1 Implement `src/editor/saveDocument.ts`: `pmToMdast`, `serializeMarkdown`,
      atomic write via temporary file plus rename in the same directory
- [x] 3.2 Handle serialization failure: write nothing, report to the user
- [x] 3.3 Wire the explicit save keyboard shortcut, bypassing the debounce
- [x] 3.4 Resolve the design.md open question on whether a failed save offers the
      raw view as a recovery path, and implement the decision

## 4. Dirty state and autosave

- [x] 4.1 Implement dirty detection by comparing serialized output against the bytes
      last written, not by counting transactions
- [x] 4.2 Add the dirty indicator to the title bar
- [x] 4.3 Implement the debounced autosave with the interval as a single named
      constant; resolve the interval open question from design.md
- [x] 4.4 Guard autosave so it never fires on a clean document
- [x] 4.5 Write tests: edit marks dirty, reverted edit clears dirty, unedited
      document never dirty, autosave skipped when clean

## 5. Session store cleanup

- [x] 5.1 Remove the editable document tree from `src/store/session.ts`, leaving
      path, dirty flag and mode
- [x] 5.2 Move every consumer that read the editable tree to read from the editor
      instance instead
- [x] 5.3 Keep the reader's read-only tree path unchanged
- [x] 5.4 Write a test asserting no transaction handler writes document content
      into the store

## 6. Round-trip verification on disk

- [x] 6.1 Write an integration test that copies a fixture to a temporary directory,
      opens it, saves without editing, and asserts the bytes are unchanged
- [x] 6.2 Extend that test to a full real-world document from this repository
- [x] 6.3 Write a test asserting tables, code blocks and frontmatter survive a save
      that edits an unrelated part of the document
- [x] 6.4 Write a test asserting the atomic write leaves the original intact when
      the write fails partway
- [x] 6.5 Write the reader-versus-editor parity test over the shared fixture corpus

## 7. Verification

- [x] 7.1 Run `npm run lint` and fix all findings
- [x] 7.2 Run `npm run typecheck` and fix all findings
- [x] 7.3 Run `npm run test` and confirm green
- [x] 7.4 Add a Playwright e2e test: open a real file, edit, save, reopen, confirm
      the edit persisted
- [x] 7.5 Manually verify in `npm run tauri:dev` that opening and saving an
      untouched file leaves `git status` clean (deferred: user will verify
      manually once all phases are implemented)

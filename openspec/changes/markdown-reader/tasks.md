## 1. Shared typography

- [x] 1.1 Create `src/ui/typography.css` with font family, size scale, heading
      scale, line height, paragraph spacing and list indentation, scoped to a
      single `.markflow-prose` root class
- [x] 1.2 Import it from `src/styles.css` and document in `docs/architecture.md`
      that both reader and editor must consume it and neither may redefine these rules

## 2. mdast renderer

- [x] 2.1 Create `src/reader/renderNode.tsx` with a per-node-type render map
      covering root, heading, paragraph, text, emphasis, strong, delete, inlineCode,
      link, list, listItem, blockquote, code, thematicBreak, image, html and yaml
- [x] 2.2 Create `src/reader/renderMdast.tsx` exporting the pure entry point
- [x] 2.3 Create `src/reader/ReaderView.tsx` wrapping the output in `.markflow-prose`
- [ ] 2.4 Write `src/reader/__tests__/render.test.tsx` covering headings, paragraphs,
      table, code block, image, task list, and asserting the tree is not mutated

## 3. Outline

- [ ] 3.1 Create `src/reader/outline.ts` deriving an outline from headings, with a
      stable slug id per heading; handle duplicate heading text
- [ ] 3.2 Give rendered headings their slug id as a DOM anchor
- [ ] 3.3 Create `src/reader/OutlinePanel.tsx` rendering the outline indented by level
- [ ] 3.4 Implement active-entry tracking with `IntersectionObserver`
- [ ] 3.5 Implement click-to-scroll navigation
- [ ] 3.6 Write tests for outline derivation, including a document with no headings

## 4. Session state and view modes

- [ ] 4.1 Create `src/store/session.ts` with a Zustand slice holding file path,
      parsed tree, mode and outline
- [ ] 4.2 Model mode as a single union value `reader | raw | editor`, with `editor`
      declared but not yet reachable
- [ ] 4.3 Create `src/reader/RawView.tsx` serializing the current tree through
      `serializeMarkdown` and labelling it as the content that would be saved
- [ ] 4.4 Wire the mode-switch keyboard shortcut
- [ ] 4.5 Write tests asserting no combination of state can represent two modes at once

## 5. File opening

- [ ] 5.1 Implement `src/store/openFile.ts` using `@tauri-apps/plugin-dialog` and
      `@tauri-apps/plugin-fs` to read and parse a chosen file
- [ ] 5.2 Handle the cancelled-dialog and unreadable-file paths with a user-visible
      error that leaves the app usable
- [ ] 5.3 Add a Rust command in `src-tauri/src/lib.rs` reading the startup file
      argument and emitting it to the frontend
- [ ] 5.4 Subscribe to that event on the frontend and open the document in reader mode
- [ ] 5.5 Handle startup with no argument and with an invalid path

## 6. Application shell

- [ ] 6.1 Replace the placeholder `src/App.tsx` with the reader layout: title bar,
      outline toggle, document column
- [ ] 6.2 Show the open file name in the window title
- [ ] 6.3 Implement the empty state shown when no document is open
- [ ] 6.4 Resolve the outline panel-versus-toggle open question from design.md and
      record the decision

## 7. Verification

- [ ] 7.1 Add a Playwright e2e test in `tests/e2e/`: open a fixture document, assert
      formatted output, toggle to raw view, navigate via the outline
- [ ] 7.2 Run `npm run lint` and fix all findings
- [ ] 7.3 Run `npm run typecheck` and fix all findings
- [ ] 7.4 Run `npm run test` and confirm green
- [ ] 7.5 Run `npm run tauri:dev` and confirm a real `.md` file opens and renders

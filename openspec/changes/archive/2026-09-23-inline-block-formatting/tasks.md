## 1. Inline marks

- [x] 1.1 Add the `strong`, `emphasis`, `strikethrough`, `inlineCode` and `link`
      mark specs to `src/core/schema/`
- [x] 1.2 Create one handler module per mark under `src/core/mapping/handlers/`,
      each registering its own forward and backward pair
- [x] 1.3 Add fixtures for each mark, plus overlapping marks, to the corpus
- [x] 1.4 Confirm the registry completeness test still passes and that no file
      under `src/core/mapping/` outside the handlers and the composition entry
      point was modified

## 2. Block nodes

- [x] 2.1 Add `list` (one type for bulleted and ordered lists, with `ordered`,
      `start` and `spread` attributes — see design D9), `listItem` (with optional
      `checked`), `blockquote`, `codeBlock` (with `language` attribute) and
      `thematicBreak` node specs to the schema
- [x] 2.2 Create one handler module per block node type
- [x] 2.3 Model task items as list items carrying `checked`, matching mdast; do not
      introduce a distinct task list node type
- [x] 2.4 Store the code block language as a schema attribute mapping to the mdast
      `lang` field, not as a rendered class name
- [x] 2.5 Add fixtures: nested lists, mixed ordered and unordered, loose and tight
      lists, task items in nested lists, quotes containing multiple blocks, code
      blocks with and without a language, thematic breaks

## 3. Editor extensions and shortcuts

- [x] 3.1 Register Tiptap extensions for every new mark and node, built on the core
      schema specs
- [x] 3.2 Create `src/editor/shortcuts.ts` as the single declaration point for the
      editor shortcut table
- [x] 3.3 Implement mark toggling with and without a selection
- [x] 3.4 Verify no shortcut collides with the operating system or the webview on
      Windows, and resolve any conflict in the shortcut table
      (reviewed against the Windows/Edge/WebView2 shortcut lists and exercised in
      Chromium via Playwright; not yet run inside a built Tauri/WebView2 binary.
      Conflicts resolved: inline code is `Mod-Shift-e`, since `Mod-e` cycles view
      modes; strikethrough is `Mod-Shift-x`, avoiding Edge's `Mod-Shift-s`)
- [x] 3.5 Implement Enter behavior in lists: continue on a non-empty item, exit on
      an empty item, including inside nested lists
- [x] 3.6 Implement list indent and outdent

## 4. Input rules

- [x] 4.1 Create `src/editor/inputRules/` with one rule module per element
- [x] 4.2 Implement rules for headings, bold, italic, strikethrough, inline code,
      bulleted and numbered list items, task items, blockquotes, code fences and
      horizontal rules
- [x] 4.3 Ensure each conversion is applied as a single transaction, so one undo
      restores the literal typed text
- [x] 4.4 Suppress input rules inside code blocks
- [x] 4.5 Add the settings flag that disables automatic conversion, and honour it
- [x] 4.6 Write tests for the single-undo behavior and for suppression inside code

## 5. Links

- [x] 5.1 Build the link affordance in `src/ui/` for creating and editing a target
- [x] 5.2 Bind it to a shortcut; resolve the design.md open question on which key
- [x] 5.3 Implement paste-URL-over-selection to create a link
- [x] 5.4 Implement link removal preserving the text
- [x] 5.5 Write tests for create, edit target, paste-over-selection and remove

## 6. Preservation and parity

- [x] 6.1 Confirm the unhandled-node fallback is still registered and that tables,
      images and frontmatter still survive an edit-and-save cycle
- [x] 6.2 Extend the reader-and-editor parity corpus with every element added here
- [x] 6.3 Extend the reader renderer only where a new element revealed a gap
      (no gap found; the renderer already handled every element. Shared block
      styles moved from `reader.css` to `typography.css` instead)

## 7. Verification

- [x] 7.1 Run the round-trip suite and confirm both invariants hold over the
      extended corpus
- [x] 7.2 Run `npm run lint` and fix all findings
- [x] 7.3 Run `npm run typecheck` and fix all findings
- [x] 7.4 Run `npm run test` and confirm green
- [x] 7.5 Add a Playwright e2e test covering typing with input rules, applying marks
      by shortcut, and creating a link
- [x] 7.6 Record in `docs/architecture.md` whether the registry design held without
      changes to the mapping core, since this change is its first real test

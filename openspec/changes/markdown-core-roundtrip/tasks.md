## 1. Markdown pipeline

- [ ] 1.1 Create `src/core/markdown/options.ts` with the pinned `remark-stringify`
      options (`bullet`, `emphasis`, `strong`, `fence`, `fences`, `rule`,
      `listItemIndent`, `incrementListMarker`) exported as a frozen constant
- [ ] 1.2 Create `src/core/markdown/parse.ts` exporting `parseMarkdown(source): Root`
      using `unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml"])`
- [ ] 1.3 Create `src/core/markdown/serialize.ts` exporting
      `serializeMarkdown(tree): string`, taking no options parameter
- [ ] 1.4 Create `src/core/markdown/index.ts` re-exporting only `parseMarkdown` and
      `serializeMarkdown`
- [ ] 1.5 Write `src/core/__tests__/markdown.test.ts`: parsing headings, paragraphs,
      GFM table, strikethrough, task list, YAML frontmatter; serialization determinism

## 2. ProseMirror schema

- [ ] 2.1 Create `src/core/schema/nodes.ts` defining `doc`, `paragraph`, `heading`
      (with `level` attribute, 1-6) and `text` node specs
- [ ] 2.2 Create `src/core/schema/index.ts` exporting the assembled `Schema` instance
- [ ] 2.3 Write `src/core/__tests__/schema.test.ts`: valid document accepted, heading
      level 7 rejected, heading levels 1-6 accepted

## 3. Mapping registry

- [ ] 3.1 Create `src/core/mapping/types.ts` defining `MdastToPmHandler`,
      `PmToMdastHandler` and the registry shape
- [ ] 3.2 Create `src/core/mapping/registry.ts` with `registerNode(type, forward, backward)`
      and lookup helpers
- [ ] 3.3 Create `src/core/mapping/handlers/text.ts`, `paragraph.ts` and `heading.ts`,
      each registering its own handler pair
- [ ] 3.4 Create `src/core/mapping/mdastToPm.ts` walking the mdast tree through the
      registry and producing a ProseMirror document
- [ ] 3.5 Create `src/core/mapping/pmToMdast.ts` walking the ProseMirror document
      through the registry and producing an mdast root
- [ ] 3.6 Create `src/core/mapping/index.ts` composing all handler modules and
      exporting `mdastToPm` and `pmToMdast`
- [ ] 3.7 Write a test asserting every registered forward handler has a backward
      counterpart, so a half-registered node type fails the suite

## 4. Preservation of unsupported content

- [ ] 4.1 Add an opaque `preserved` node to the schema carrying the original mdast
      subtree in an attribute, rendered as an inert non-editable block
- [ ] 4.2 Make `mdastToPm` fall back to the `preserved` node for any node type with
      no registered forward handler
- [ ] 4.3 Make `pmToMdast` return the stored subtree verbatim for `preserved` nodes
- [ ] 4.4 Write tests: GFM table survives a full round-trip, YAML frontmatter
      survives, stored subtree equals its `structuredClone`

## 5. Round-trip test infrastructure

- [ ] 5.1 Create `src/core/fixtures/` with edge-case fixtures: empty document,
      single empty heading, consecutive paragraphs, trailing blank lines, all six
      heading levels
- [ ] 5.2 Copy this repository's `README.md`, `Context/EXPLORE.md` and
      `docs/architecture.md` into the fixture corpus as real-world documents
- [ ] 5.3 Add a fixture manifest marking which fixtures are in serializer normal
      form, so the text invariant runs only over those
- [ ] 5.4 Implement `stripPositions()` in the test helpers
- [ ] 5.5 Write `src/core/__tests__/roundtrip.test.ts` asserting the text invariant
      over normalized fixtures and the structural invariant over all fixtures
- [ ] 5.6 Resolve the trailing-newline open question from design.md against the
      corpus and record the decision in `docs/architecture.md`

## 6. Verification

- [ ] 6.1 Remove the placeholder `src/core/__tests__/toolchain.test.ts` now that
      real core tests cover the pipeline
- [ ] 6.2 Add a test asserting no module under `src/core/` imports React or any
      UI-layer module
- [ ] 6.3 Run `npm run lint` and fix all findings
- [ ] 6.4 Run `npm run typecheck` and fix all findings
- [ ] 6.5 Run `npm run test` and confirm every round-trip invariant is green
- [ ] 6.6 Confirm CI passes on push

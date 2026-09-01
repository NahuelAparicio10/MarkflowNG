## Why

Markflow persists documents as plain Markdown but edits them through ProseMirror.
The bidirectional mapping between those two representations is the load-bearing
piece of the entire product: if the ProseMirror schema cannot represent something
that existed in the original Markdown, that content is silently destroyed on save.
Discovering this late means rewriting the schema and every extension built on it,
which is the most common way projects of this shape fail.

This change closes the round-trip on a deliberately minimal node set
(`doc`, `paragraph`, `heading`, `text`) so the invariant is proven and enforced by
tests before any UI exists. Corresponds to **Fase 1** of `Context/EXPLORE.md`.

## What Changes

- Add a configured `unified`/`remark` pipeline in `src/core/markdown/` exposing
  `parseMarkdown(md) -> mdast` and `serializeMarkdown(mdast) -> md`, with GFM and
  YAML frontmatter enabled and stringify options pinned so output is deterministic.
- Add a ProseMirror schema in `src/core/schema/` covering `doc`, `paragraph`,
  `heading` (levels 1-6) and `text`.
- Add the bidirectional mapping in `src/core/mapping/`: `mdastToPm()` and
  `pmToMdast()`, driven by a per-node-type registry so later phases extend the
  mapping by registering handlers rather than editing a growing switch.
- Add a round-trip test suite with a fixture corpus of real `.md` files, asserting
  both invariants: `serialize(parse(md)) === md` for normalized Markdown, and
  `parse(serialize(doc))` structurally equal to `doc`.
- Add an unsupported-node policy: any mdast node with no registered handler is
  preserved verbatim rather than dropped.
- **No UI.** Nothing in this change imports React.

## Capabilities

### New Capabilities
- `markdown-core`: parsing Markdown to a canonical mdast AST, serializing mdast
  back to Markdown, the ProseMirror document schema, the bidirectional mapping
  between mdast and ProseMirror, and the round-trip guarantees that bind them.

### Modified Capabilities

_None. This is the first capability in the project._

## Impact

- New code: `src/core/markdown/`, `src/core/schema/`, `src/core/mapping/`,
  `src/core/__tests__/`, `src/core/fixtures/`.
- Dependencies already installed: `unified`, `remark-parse`, `remark-stringify`,
  `remark-gfm`, `remark-frontmatter`, `@tiptap/pm`, `@types/mdast`.
- Establishes the contract that every later phase extends. Phases 1.5 through 7
  all consume `src/core/` and none may bypass it.
- No user-visible change; the app shell still renders a placeholder.

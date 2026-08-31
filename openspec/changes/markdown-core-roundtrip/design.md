## Context

The project is a fresh Tauri 2 + React 19 + TypeScript scaffold. No product code
exists yet beyond an app shell. `Context/EXPLORE.md` fixes the stack and states
that the Markdown core lives in TypeScript, that mdast is the canonical AST, and
that the round-trip must be closed from day one.

The constraint that shapes every decision below: the ProseMirror document model is
a *constrained tree* validated by a schema, while mdast is an *unconstrained tree*
that can hold anything remark parses. The mapping is therefore lossy by default,
and the work is to make the loss explicit and bounded instead of silent.

## Goals / Non-Goals

**Goals:**
- A deterministic `parse` / `serialize` pair: serializing an already-normalized
  document reproduces it byte for byte.
- A ProseMirror schema for `doc`, `paragraph`, `heading`, `text`.
- `mdastToPm()` and `pmToMdast()` that are mutual inverses over that node set.
- An extension mechanism so phases 3, 5 and 6 add nodes without touching the
  mapping core.
- Content with no registered handler survives a round-trip unchanged.
- Test infrastructure (fixture corpus, invariant assertions) that later phases
  extend by adding fixtures rather than by writing new harnesses.

**Non-Goals:**
- Any React component, any Tiptap extension, any file I/O. Those are phases 1.5+.
- Formatting marks, lists, tables, images, code blocks. Deliberately excluded so
  the round-trip mechanism is proven on the smallest possible surface.
- Markdown normalization as a product feature. Reformatting a file on open is a
  separate decision, not something this change smuggles in.

## Decisions

### D1. mdast is the canonical AST; ProseMirror is downstream

The pipeline is `markdown <-> mdast <-> ProseMirror`, never `markdown <-> ProseMirror`
directly.

*Alternatives considered:* parsing Markdown straight into ProseMirror via
`prosemirror-markdown`. Rejected because it is built on markdown-it, which has no
GFM parity with remark and produces no mdast to hand to the reader, the explorer
preview and the AI layer. A single AST shared by all four consumers is what lets
the AI layer operate on structure instead of on strings (EXPLORE.md section 6).

### D2. A node-handler registry, not a switch statement

Mapping in both directions is driven by two lookup tables keyed by node type.
Each phase registers its handlers in its own module; `src/core/mapping/index.ts`
composes them.

*Alternatives considered:* a `switch (node.type)` per direction. Rejected because
by phase 5 that is a ~20-arm switch in two functions kept in sync by hand, with
nothing structurally forcing a new node to be handled in both directions. With a
registry, a missing inverse is a typed gap and a test can assert that every
forward handler has a backward counterpart.

### D3. Unsupported nodes are preserved, not dropped

Any mdast node without a forward handler maps to an opaque ProseMirror node that
carries the original mdast subtree in an attribute and renders as an inert block.
Its backward handler returns that subtree verbatim.

*Alternatives considered:*
- *Drop unknown nodes.* Rejected outright: opening and saving a file would
  silently delete content. This is the worst failure mode the product can have.
- *Refuse to open documents containing unknown nodes.* Rejected: it makes every
  intermediate phase unusable on real files, and the reader must open arbitrary
  Markdown.

This decision is what makes the phased rollout safe. During phases 1 to 4 a file
containing a table opens, survives and saves intact even though tables do not
become editable until phase 5.

### D4. Stringify options are pinned and centralized

`remark-stringify` is configured once, in `src/core/markdown/`, with explicit
`bullet`, `emphasis`, `strong`, `fence`, `rule`, `listItemIndent` and
`incrementListMarker` settings. No call site may pass its own options.

*Alternatives considered:* leaving defaults implicit. Rejected because the
round-trip invariant is defined against a normalization: `serialize(parse(md))`
equals `md` only for Markdown already in the serializer normal form. If those
options vary per call site, the normal form is not well defined and the invariant
becomes untestable.

### D5. Two distinct invariants, tested separately

- **Text invariant:** `serialize(parse(md)) === md`, asserted only over fixtures
  already in normal form.
- **Structural invariant:** `parse(serialize(pmToMdast(mdastToPm(parse(md)))))`
  is deeply equal to `parse(md)`, modulo positional metadata. Asserted over all
  fixtures, including non-normalized ones.

*Alternatives considered:* one string-equality test over every fixture. Rejected
because it conflates two different failures: "the normal form differs from the
input formatting", which is benign and expected, and "the mapping lost
information", which is a bug. Separating them means a failing test names the real
problem.

### D6. Position metadata is stripped before structural comparison

remark attaches `position` offsets to every mdast node. They are meaningful on
parse and meaningless after a ProseMirror round-trip. A `stripPositions()` helper
normalizes both sides before deep comparison.

*Alternatives considered:* a custom deep-equal that skips `position` keys.
Equivalent in effect but harder to debug, since assertion diffs then show nodes
that look identical. Stripping first produces readable diffs.

### D7. Frontmatter is parsed but not editable

`remark-frontmatter` is enabled so YAML frontmatter becomes a first-class `yaml`
mdast node. It is handled by the D3 preservation path in this change.

*Alternatives considered:* disabling frontmatter until a later phase. Rejected
because without the plugin remark actively mis-parses `---` delimited blocks, so
the preservation path would faithfully preserve the wrong structure. Cheap now,
expensive to retrofit.

## Risks / Trade-offs

- **The four-node surface is too small to expose real mapping problems** →
  Mitigated by D3: the fixture corpus includes full real documents (this repo's
  `README.md`, `Context/EXPLORE.md`, `docs/architecture.md`), so tables, lists and
  code blocks flow through the preservation path from day one and their round-trip
  is asserted before they are editable.
- **Preserved-node attributes stop being JSON-serializable** → mdast is plain JSON
  by construction; a test asserts `structuredClone` equality on the stored subtree
  to catch regressions.
- **Pinned stringify options do not match a file's existing style, so the first
  save reformats it and produces a large diff** → Accepted and explicit. Inferring
  per-file style is a research project. The chosen options match the most common
  conventions (`-` bullets, `*` emphasis, backtick fences) and re-normalizing is a
  one-time cost per file. Revisit only if it proves painful on real repositories.
- **`remark-gfm` is enabled while GFM nodes are not yet editable** → Intentional.
  Parsing them correctly and preserving them is strictly better than mis-parsing
  them, and phase 5 then only adds handlers rather than fixing parsing.

## Migration Plan

Not applicable. No existing behavior, no persisted data, no users. The change is
additive and lands behind no flag.

## Open Questions

- Should `serialize` guarantee a trailing newline unconditionally? remark does by
  default; some real files lack one. Leaning yes (POSIX convention, cleaner git
  diffs), to be settled against the fixture corpus during implementation.
- Should the opaque preserved node be one node type, or one per unsupported mdast
  type? Starting with one; revisit if the reader needs to distinguish them.

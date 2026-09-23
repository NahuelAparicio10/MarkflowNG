# markdown-core Specification

## Purpose
The Markdown core: parsing to canonical mdast, deterministic serialization, the ProseMirror schema and the bidirectional mapping between them, with preservation of unsupported content and enforced round-trip invariants. Created by archiving change markdown-core-roundtrip; extended by inline-block-formatting.
## Requirements

### Requirement: Markdown parsing to canonical mdast

The system SHALL expose a single `parseMarkdown(source: string): Root` function
that converts Markdown text into an mdast tree. The parser MUST have GFM
extensions and YAML frontmatter support enabled, and MUST be the only parsing
entry point in the codebase.

#### Scenario: Parsing headings and paragraphs

- **WHEN** `parseMarkdown("# Title\n\nBody text\n")` is called
- **THEN** the result is a `root` node whose children are a `heading` of depth 1
  containing the text `Title`, followed by a `paragraph` containing the text
  `Body text`

#### Scenario: Parsing GFM constructs

- **WHEN** `parseMarkdown` receives a document containing a GFM table, a
  strikethrough span and a task list item
- **THEN** the result contains `table`, `delete` and `listItem` nodes with
  `checked` set, rather than those constructs being parsed as plain text

#### Scenario: Parsing YAML frontmatter

- **WHEN** `parseMarkdown` receives a document beginning with a `---` delimited
  YAML block
- **THEN** the first child of the root is a `yaml` node holding the block content
- **AND** the block is not parsed as a thematic break followed by a paragraph

### Requirement: Deterministic Markdown serialization

The system SHALL expose a single `serializeMarkdown(tree: Root): string` function
that converts an mdast tree back into Markdown text. Serializer options MUST be
defined once in `src/core/markdown/` and MUST NOT be overridable by call sites, so
that a single normal form is defined for the whole application.

#### Scenario: Serializing is deterministic

- **WHEN** `serializeMarkdown` is called twice with the same tree
- **THEN** both calls return byte-identical strings

#### Scenario: Normalized input survives a text round-trip

- **WHEN** `md` is a Markdown document already in the serializer normal form
- **THEN** `serializeMarkdown(parseMarkdown(md))` equals `md` exactly

#### Scenario: Call sites cannot change the normal form

- **WHEN** application code outside `src/core/markdown/` needs to serialize
- **THEN** the exported API accepts no serializer options parameter

### Requirement: ProseMirror document schema

The system SHALL define a ProseMirror schema in `src/core/schema/` containing the
node types `doc`, `paragraph`, `heading` and `text`. The `heading` node MUST carry
a `level` attribute constrained to the integers 1 through 6.

#### Scenario: Valid document is accepted

- **WHEN** a ProseMirror document consisting of a heading of level 2 and a
  paragraph is validated against the schema
- **THEN** validation succeeds

#### Scenario: Out-of-range heading level is rejected

- **WHEN** a node of type `heading` with `level` 7 is constructed from the schema
- **THEN** the schema rejects it

#### Scenario: Schema is UI-independent

- **WHEN** the modules under `src/core/` are inspected for imports
- **THEN** none of them import React, any React package, or any module under
  `src/ui/`, `src/editor/`, `src/reader/` or `src/explorer/`

### Requirement: Bidirectional mdast and ProseMirror mapping

The system SHALL expose `mdastToPm(tree: Root): PmNode` and
`pmToMdast(node: PmNode): Root`. Both directions MUST be driven by a registry
keyed by node type, so that support for a new node type is added by registering a
handler pair rather than by modifying the mapping core.

#### Scenario: Heading maps in both directions

- **WHEN** an mdast `heading` of depth 3 containing the text `Design` is passed
  through `mdastToPm` and then `pmToMdast`
- **THEN** the result is an mdast `heading` of depth 3 containing the text `Design`

#### Scenario: Every forward handler has an inverse

- **WHEN** the mapping registry is inspected
- **THEN** every registered mdast-to-ProseMirror handler has a corresponding
  ProseMirror-to-mdast handler, and the check fails the test suite if one is missing

#### Scenario: Adding a node type does not modify the core

- **WHEN** a new node type handler pair is registered from its own module
- **THEN** no file under `src/core/mapping/` other than the composition entry
  point requires modification

### Requirement: Preservation of unsupported content

Content whose mdast node type has no registered handler SHALL be preserved
verbatim across a full round-trip. The system MUST NOT drop, flatten or otherwise
alter such content, and MUST NOT refuse to open a document that contains it.

#### Scenario: Table survives before tables are editable

- **WHEN** a document containing a GFM table is parsed, mapped to ProseMirror,
  mapped back to mdast and serialized
- **THEN** the resulting Markdown contains the same table as the input

#### Scenario: Frontmatter survives

- **WHEN** a document beginning with a YAML frontmatter block completes a full
  round-trip
- **THEN** the frontmatter block is present in the output, unchanged

#### Scenario: Preserved subtree remains plain data

- **WHEN** an unsupported node is stored in a ProseMirror node attribute
- **THEN** the stored subtree is deeply equal to its `structuredClone`

### Requirement: Enforced round-trip invariants

The test suite SHALL assert two invariants separately over a fixture corpus of
real Markdown documents. The text invariant asserts that serializing a parsed
normalized document reproduces the input exactly. The structural invariant asserts
that a full pass through ProseMirror and back preserves the mdast tree, ignoring
positional metadata.

#### Scenario: Text invariant over normalized fixtures

- **WHEN** the suite runs over each fixture marked as normalized
- **THEN** `serializeMarkdown(parseMarkdown(fixture))` equals the fixture exactly

#### Scenario: Structural invariant over all fixtures

- **WHEN** the suite runs over every fixture, normalized or not
- **THEN** the mdast tree obtained after a full ProseMirror round-trip is deeply
  equal to the tree obtained by parsing the fixture directly, once positional
  metadata is stripped from both

#### Scenario: Edge cases are covered

- **WHEN** the fixture corpus is inspected
- **THEN** it includes an empty document, a document that is a single empty
  heading, consecutive paragraphs, trailing blank lines at end of file, headings
  of every level 1 through 6, and at least one full real-world document taken
  from this repository

#### Scenario: Regression is caught before merge

- **WHEN** a change breaks either invariant
- **THEN** `npm run test` exits non-zero and continuous integration fails the build

### Requirement: Schema and mapping coverage for marks and block structure

The ProseMirror schema SHALL include the marks strong, emphasis, strikethrough,
inline code and link, and the block nodes list (bulleted or ordered, as an
attribute, matching mdast), list item
with optional checked state, blockquote, code block with language, and thematic
break. Each MUST have a registered handler pair in both mapping directions.

#### Scenario: Every new type is registered in both directions

- **WHEN** the mapping registry is inspected after this change
- **THEN** each mark and block node listed above has both a forward and a backward
  handler, and the existing completeness check still passes

#### Scenario: Adding these types did not modify the mapping core

- **WHEN** the diff of this change is inspected
- **THEN** no file under `src/core/mapping/` other than the composition entry point
  and the per-type handler modules was modified

#### Scenario: Handlers live in their own modules

- **WHEN** the handler directory is inspected
- **THEN** each element type has its own module registering its handler pair

### Requirement: Round-trip coverage extends to the new element types

The round-trip fixture corpus SHALL be extended so that both the text invariant and
the structural invariant cover every element type made editable by this change.

#### Scenario: Fixtures cover marks

- **WHEN** the fixture corpus is inspected
- **THEN** it includes fixtures for strong, emphasis, strikethrough, inline code,
  links, and overlapping marks

#### Scenario: Fixtures cover list edge cases

- **WHEN** the fixture corpus is inspected
- **THEN** it includes nested lists, mixed ordered and unordered lists, loose and
  tight lists, and task items inside nested lists

#### Scenario: Fixtures cover block elements

- **WHEN** the fixture corpus is inspected
- **THEN** it includes blockquotes containing multiple blocks, code blocks with and
  without a language, and thematic breaks

#### Scenario: Invariants hold over the extended corpus

- **WHEN** the test suite runs
- **THEN** the text invariant holds for every normalized fixture and the structural
  invariant holds for every fixture

### Requirement: Reader and editor parity extends to the new element types

The reader-and-editor parity test SHALL cover every element type made editable by
this change.

#### Scenario: Parity across the new elements

- **WHEN** a fixture containing marks, lists, task lists, quotes, code blocks and
  thematic breaks is rendered by the reader and by the editor
- **THEN** the resulting text content is equivalent

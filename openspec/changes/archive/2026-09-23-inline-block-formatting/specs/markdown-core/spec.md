## ADDED Requirements

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

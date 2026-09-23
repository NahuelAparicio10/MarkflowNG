## ADDED Requirements

### Requirement: Schema and mapping coverage for tables and images

The ProseMirror schema SHALL include table, table row, header cell, cell and image
node types, each with a registered handler pair in both mapping directions. Adding
them MUST NOT require modifying the mapping core.

#### Scenario: Table and image types are registered in both directions

- **WHEN** the mapping registry is inspected after this change
- **THEN** every table-related node type and the image node have both a forward and
  a backward handler, and the completeness check passes

#### Scenario: The mapping core was not modified

- **WHEN** the diff of this change is inspected
- **THEN** no file under `src/core/mapping/` other than the composition entry point
  and the per-type handler modules was modified

### Requirement: Round-trip coverage for table and image edge cases

The fixture corpus SHALL be extended with the cases that distinguish the canonical
AST table model from the editor table model, and both invariants MUST hold over them.

#### Scenario: Table fixtures cover the difficult cases

- **WHEN** the fixture corpus is inspected
- **THEN** it includes empty cells, cells containing inline marks and links,
  single-column tables, single-row tables, ragged rows, every alignment
  combination, and cells whose content contains pipe characters or escapes

#### Scenario: Image fixtures cover reference forms

- **WHEN** the fixture corpus is inspected
- **THEN** it includes relative paths, absolute URLs, images with and without alt
  text, and images carrying a title written by another tool

#### Scenario: Invariants hold over the extended corpus

- **WHEN** the test suite runs
- **THEN** the text invariant holds for every normalized fixture and the structural
  invariant holds for every fixture

### Requirement: Preservation narrows but remains

The unhandled-node fallback SHALL remain registered after tables and images become
editable, continuing to cover frontmatter, raw HTML and any node type the schema
does not model.

#### Scenario: Fallback is still registered

- **WHEN** the mapping is inspected
- **THEN** the unhandled-node fallback is present

#### Scenario: Frontmatter still survives

- **WHEN** a document with YAML frontmatter is opened, edited elsewhere and saved
- **THEN** the frontmatter is unchanged in the saved file

#### Scenario: Unknown constructs still survive

- **WHEN** a document containing a Markdown construct the schema does not model is
  opened, edited elsewhere and saved
- **THEN** that construct is unchanged in the saved file

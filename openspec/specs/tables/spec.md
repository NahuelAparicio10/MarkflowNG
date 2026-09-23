# tables Specification

## Purpose
GFM tables in the editor and reader: structure with a mandatory header row, prevention of merged cells, row and column editing, per-column alignment stored on the table, column widths as view state, and normalization of ragged rows. Created by archiving change tables-and-images.
## Requirements

### Requirement: Table structure

The system SHALL support tables consisting of a header row followed by body rows.
The first row MUST always be the header, matching the target Markdown format, which
has no representation for a table without one.

#### Scenario: Inserting a table

- **WHEN** the user inserts a table
- **THEN** a table is created with a header row and at least one body row

#### Scenario: First row is the header

- **WHEN** any table is inspected
- **THEN** its first row consists of header cells and it cannot be converted into a
  body row

#### Scenario: Table round-trips

- **WHEN** a document containing a table completes a full round-trip
- **THEN** the serialized output is an equivalent table

### Requirement: Merged cells are prevented

The system SHALL constrain every cell to a single row and column span, and MUST NOT
expose cell merging. Because the target Markdown format cannot represent merged
cells, the system MUST prevent the user from creating them rather than flattening
them on save.

#### Scenario: Merge is not offered

- **WHEN** the user selects multiple cells
- **THEN** no merge operation is available

#### Scenario: Schema forbids spans

- **WHEN** a cell node is constructed with a column or row span greater than one
- **THEN** the schema rejects it

#### Scenario: No silent flattening

- **WHEN** a table is saved and reopened
- **THEN** its structure is identical, because no state was reachable that the
  format could not hold

### Requirement: Table editing operations

The system SHALL support inserting and deleting rows and columns, selecting cells,
and navigating between cells with the keyboard.

#### Scenario: Adding a row

- **WHEN** the user inserts a row
- **THEN** a row with the same number of cells as the table is added and the
  document round-trips

#### Scenario: Adding a column

- **WHEN** the user inserts a column
- **THEN** a cell is added to every row including the header, and the document
  round-trips

#### Scenario: Deleting the last column

- **WHEN** the user deletes the only remaining column
- **THEN** the table is removed rather than left in an invalid state

#### Scenario: Keyboard navigation

- **WHEN** the user presses Tab in a cell
- **THEN** the caret moves to the next cell, and from the last cell creates or
  moves to the next row according to the implemented convention

### Requirement: Column alignment

Column alignment SHALL be stored on the table node as a per-column value, mirroring
the canonical AST, and MUST NOT be stored per cell, so that cells within a column
cannot disagree.

#### Scenario: Setting alignment

- **WHEN** the user sets a column to right alignment
- **THEN** every cell in that column is displayed right aligned

#### Scenario: Alignment round-trips

- **WHEN** a table with left, right, centre and default aligned columns completes a
  round-trip
- **THEN** each column retains its alignment in the serialized output

#### Scenario: Cells cannot disagree

- **WHEN** the table node is inspected
- **THEN** alignment is a per-column value on the table, not an attribute of
  individual cells

### Requirement: Column resizing is view state

Column widths SHALL be treated as view state and MUST NOT be persisted to the
document, because the target format has no representation for them.

#### Scenario: Resizing a column

- **WHEN** the user drags a column border
- **THEN** the displayed width changes

#### Scenario: Width is not written to disk

- **WHEN** a document whose table columns were resized is saved
- **THEN** the serialized Markdown contains no width information and is unchanged
  by the resize

### Requirement: Ragged tables are normalized on load

Tables whose rows have differing cell counts SHALL be normalized on load by padding
short rows with empty cells. The normalization MUST be deliberate and covered by a
fixture rather than incidental.

#### Scenario: Short row is padded

- **WHEN** a document containing a table with a row shorter than its header is
  opened
- **THEN** the row is padded with empty cells so the table is rectangular

#### Scenario: Normalization is covered by a fixture

- **WHEN** the fixture corpus is inspected
- **THEN** it contains a ragged table fixture asserting the padded result

## ADDED Requirements

### Requirement: Lists

The system SHALL support bulleted and numbered lists, including nesting. List
items MUST be editable, indentable and removable without exposing Markdown syntax.

#### Scenario: Creating a list by input rule

- **WHEN** the user types a hyphen followed by a space at the start of an empty
  paragraph
- **THEN** the paragraph becomes a bulleted list item and the hyphen is not visible

#### Scenario: Continuing a list

- **WHEN** the user presses Enter at the end of a non-empty list item
- **THEN** a new sibling list item is created

#### Scenario: Exiting a list

- **WHEN** the user presses Enter in an empty list item
- **THEN** the item is removed and the caret moves to a paragraph outside the list

#### Scenario: Nesting

- **WHEN** the user indents a list item
- **THEN** it becomes a child of the preceding item, and the nesting round-trips

#### Scenario: Mixed and nested lists round-trip

- **WHEN** a document containing nested lists, mixed ordered and unordered lists,
  and both loose and tight list forms completes a full round-trip
- **THEN** the serialized output is equivalent to the input

### Requirement: Task lists

The system SHALL support task list items, modelled as list items carrying a
checked state rather than as a distinct list type, matching the canonical AST.

#### Scenario: Creating a task item

- **WHEN** the user types the task item syntax at the start of an empty paragraph
- **THEN** the paragraph becomes a list item with an unchecked checkbox

#### Scenario: Toggling a task

- **WHEN** the user activates the checkbox of a task item
- **THEN** the item becomes checked and the change round-trips to the checked
  Markdown form

#### Scenario: Mixed task and plain items

- **WHEN** a list contains both task items and plain items
- **THEN** the list round-trips with each item retaining its own form

### Requirement: Blockquotes

The system SHALL support blockquotes containing arbitrary block content.

#### Scenario: Creating a quote by input rule

- **WHEN** the user types a greater-than sign followed by a space at the start of
  an empty paragraph
- **THEN** the paragraph becomes a blockquote and the marker is not visible

#### Scenario: Quote containing multiple blocks

- **WHEN** a blockquote contains a heading and two paragraphs
- **THEN** all of them are inside the quote after a round-trip

### Requirement: Code blocks

The system SHALL support fenced code blocks carrying an optional language. The
language MUST be stored as a node attribute mapping directly to the AST language
field, not derived from a rendered CSS class.

#### Scenario: Creating a code block by input rule

- **WHEN** the user types a triple backtick fence at the start of an empty paragraph
- **THEN** the paragraph becomes a code block

#### Scenario: Code block content is literal

- **WHEN** the user types Markdown syntax inside a code block
- **THEN** no input rule fires and the text remains literal

#### Scenario: Language is preserved

- **WHEN** a code block with a declared language completes a round-trip
- **THEN** the language is present in the serialized output

#### Scenario: Language stored as an attribute

- **WHEN** the code block node is inspected
- **THEN** the language is a schema attribute, not a class name on the rendered
  element

### Requirement: Horizontal rules

The system SHALL support horizontal rules as block-level separators.

#### Scenario: Creating a rule by input rule

- **WHEN** the user types three hyphens on an empty line
- **THEN** a horizontal rule is inserted

#### Scenario: Rule round-trips

- **WHEN** a document containing a horizontal rule completes a round-trip
- **THEN** the rule is present in the serialized output in the pinned normal form

### Requirement: Preservation remains for unsupported content

The preservation path for content with no registered handler SHALL remain in
effect for node types not covered by this change, including tables, images and
frontmatter.

#### Scenario: Table still survives editing elsewhere

- **WHEN** a document containing a table is opened, a paragraph elsewhere is
  edited, and the document is saved
- **THEN** the table is present in the saved file, unchanged

#### Scenario: Preservation is not removed

- **WHEN** the mapping is inspected
- **THEN** the fallback for unhandled node types is still registered

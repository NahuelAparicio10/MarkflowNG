## ADDED Requirements

### Requirement: Formatted rendering of a parsed document

The system SHALL render an mdast tree as formatted React output through a pure
function that performs no side effects and mounts no editing engine. The renderer
MUST cover every node type the core parser can produce, including node types the
ProseMirror schema does not yet support.

#### Scenario: Headings and paragraphs render

- **WHEN** a document containing headings of levels 1 through 6 and paragraphs is
  rendered
- **THEN** each heading appears at its corresponding level and each paragraph
  appears as body text, with no Markdown syntax characters visible

#### Scenario: Content beyond the editable schema still renders

- **WHEN** a document containing a GFM table, a fenced code block, an image and a
  task list is rendered
- **THEN** the table appears as a table, the code block as preformatted text, the
  image as an image and the task list as checkboxes
- **AND** none of them appears as an inert placeholder

#### Scenario: Rendering is pure

- **WHEN** the same tree is rendered twice
- **THEN** both renders produce equivalent output and neither mutates the tree

#### Scenario: No editing affordances are present

- **WHEN** a document is displayed in reader mode
- **THEN** there is no caret, no editing toolbar, and typing does not modify the
  document

### Requirement: Shared typography between reader and editor

Typographic styling SHALL be defined in a single stylesheet consumed by the reader
and, from phase 2 onward, by the editor. Neither mode may define its own font
family, font size, heading scale, line height, paragraph spacing or list
indentation.

#### Scenario: Switching modes causes no visual jump

- **WHEN** the user switches between reader and editor mode on the same document
- **THEN** heading sizes, body text size, line height and block spacing are
  identical in both modes

#### Scenario: Editor-specific styling stays local

- **WHEN** the shared typographic stylesheet is inspected
- **THEN** it contains no caret, selection, toolbar or other editing-specific rules

### Requirement: Document outline

The system SHALL derive a navigable outline from the document headings. Selecting
an entry MUST scroll the document to that heading, and the entry corresponding to
the topmost visible heading MUST be indicated as active.

#### Scenario: Outline reflects heading structure

- **WHEN** a document containing nested headings is opened
- **THEN** the outline lists every heading in document order, indented by level

#### Scenario: Clicking an entry navigates

- **WHEN** the user selects an outline entry
- **THEN** the document scrolls so that the corresponding heading is visible

#### Scenario: Active entry follows scrolling

- **WHEN** the user scrolls the document so a different heading becomes topmost
- **THEN** the outline marks that heading as the active entry

#### Scenario: Document without headings

- **WHEN** a document containing no headings is opened
- **THEN** the outline is empty and does not error

### Requirement: Raw Markdown view

The system SHALL provide a raw view showing the document as Markdown text. The
raw view MUST be produced by serializing the current document tree, not by
re-reading the file from disk, so that it reflects what would be written on save.

#### Scenario: Raw view shows Markdown source

- **WHEN** the user switches to raw view
- **THEN** the Markdown text of the current document is displayed as plain text

#### Scenario: Raw view reflects the tree, not the disk

- **WHEN** the document in memory differs from the file on disk
- **THEN** the raw view shows the in-memory content and indicates that it shows
  the document as it would be saved

### Requirement: View mode switching

The system SHALL model the active view as a single mode value with the states
`reader`, `raw` and `editor`, and MUST NOT represent it as independent boolean
flags. Switching modes MUST be available through a keyboard shortcut.

#### Scenario: Mode is a single value

- **WHEN** the session state is inspected
- **THEN** exactly one mode is active and no combination of flags can represent
  two modes simultaneously

#### Scenario: Keyboard shortcut toggles mode

- **WHEN** the user presses the mode-switch shortcut in reader mode
- **THEN** the view changes mode without reloading the document

#### Scenario: Scroll position is preserved

- **WHEN** the user switches from reader to raw mode and back
- **THEN** the document is still open and no content has been altered

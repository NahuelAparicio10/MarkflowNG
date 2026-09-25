# document-editing Specification

## Purpose
TBD - created by archiving change document-editor-base. Update Purpose after archive.
## Requirements
### Requirement: Editing engine mounted on the core schema

The system SHALL mount the Tiptap editor on the ProseMirror schema defined in
`src/core/schema/`. The editor MUST NOT introduce a second schema definition, and
MUST NOT adopt a bundled default schema whose node set differs from the core one.

#### Scenario: Editor uses the core schema

- **WHEN** the mounted editor instance is inspected
- **THEN** its schema node types are exactly those defined in `src/core/schema/`

#### Scenario: No duplicate schema definition

- **WHEN** the codebase is inspected for ProseMirror node specifications
- **THEN** they are defined only under `src/core/schema/`

#### Scenario: Unsupported content remains inert but intact

- **WHEN** a document containing content outside the editable node set is opened
  in the editor
- **THEN** that content is displayed as a non-editable block and is not removable
  by ordinary typing

### Requirement: Hydrating the editor from a file

The system SHALL load a document by reading the file, parsing it with the core
parser, mapping the resulting mdast to a ProseMirror document, and hydrating the
editor with it. There MUST be exactly one load path, and it MUST go through
`src/core/`.

#### Scenario: Document loads into the editor

- **WHEN** the user opens a `.md` file and switches to editor mode
- **THEN** the document content is displayed as editable formatted content with no
  Markdown syntax characters visible

#### Scenario: Load path goes through the core

- **WHEN** the load implementation is inspected
- **THEN** it calls `parseMarkdown` and `mdastToPm` and does not construct the
  ProseMirror document by any other route

### Requirement: Text editing with undo and redo

The system SHALL allow the user to edit paragraphs and headings, and SHALL provide
undo and redo over a single coherent history owned by ProseMirror. Saving MUST NOT
create a history entry and MUST NOT clear the history.

#### Scenario: Typing modifies the document

- **WHEN** the user types into a paragraph
- **THEN** the paragraph content changes and the document is marked dirty

#### Scenario: Undo reverses an edit

- **WHEN** the user makes an edit and then invokes undo
- **THEN** the document returns to its previous state

#### Scenario: Redo reapplies an undone edit

- **WHEN** the user undoes an edit and then invokes redo
- **THEN** the edit is reapplied

#### Scenario: Autosave does not disturb history

- **WHEN** an autosave occurs after an edit and the user then invokes undo
- **THEN** the edit is reversed as if no save had happened

### Requirement: Single owner of editable content

While a document is open for editing, ProseMirror SHALL be the sole owner of its
content. The application store MUST NOT hold a copy of the editable document, and
MUST NOT synchronize a duplicate tree on each transaction.

#### Scenario: Store holds no editable content

- **WHEN** a document is open in editor mode and the session store is inspected
- **THEN** it holds the file path, the dirty flag and the mode, and no document
  content

#### Scenario: No per-transaction synchronization

- **WHEN** the editor implementation is inspected
- **THEN** no transaction handler writes the document content into the store

### Requirement: Reader and editor render equivalently

The reader and the editor SHALL present the same document with equivalent content.
Because they render from different representations, this equivalence MUST be
enforced by an automated test rather than by review.

#### Scenario: Parity across representations

- **WHEN** the same fixture document is rendered by the reader and by the editor
- **THEN** the resulting text content is equivalent

#### Scenario: Parity test grows with the schema

- **WHEN** a new node type becomes editable in a later change
- **THEN** a fixture exercising that node type is added to the parity test

### Requirement: Formatting features are discoverable

The editor SHALL expose all Markdown formatting and block operations supported by its schema through a visible toolbar. The toolbar MUST include paragraph and heading levels 1–6, bold, italic, strikethrough, inline code, link, blockquote, fenced code block with language, bulleted, numbered and task lists, horizontal rule, table, image, undo, and redo. Controls MUST expose active and disabled state without duplicating the document state outside ProseMirror.

#### Scenario: User discovers formatting without knowing shortcuts
- **WHEN** the user enters editor mode
- **THEN** visible controls expose the supported inline, block, insertion, and history operations

#### Scenario: Active formatting is visible
- **WHEN** the selection is inside bold text or a heading
- **THEN** the corresponding toolbar control indicates its active state

#### Scenario: User changes code language
- **WHEN** the selection is in a fenced code block and the user chooses `shell`
- **THEN** the block language becomes `shell` and serializes in the Markdown fence info string

### Requirement: Keyboard shortcuts are explained

Formatting controls SHALL provide accessible names and tooltips that include keyboard shortcuts where available. The application SHALL provide a help surface listing keyboard shortcuts and explaining that `/` opens the insertion command menu.

#### Scenario: Hovering a formatting icon
- **WHEN** the user hovers or focuses the Bold control
- **THEN** the interface identifies it as Bold and shows its keyboard shortcut

#### Scenario: Opening keyboard help
- **WHEN** the user activates the keyboard-help control
- **THEN** the application lists supported shortcuts and the slash-command invocation

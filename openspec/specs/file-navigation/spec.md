# file-navigation Specification

## Purpose
Moving between workspace documents: a virtualized directory tree, fuzzy quick open over a cached listing, previews rendered through the reader without an editor, and tabs that each keep their own editor, undo history and caret. Created by archiving change workspace-explorer.
## Requirements
### Requirement: Directory tree

The system SHALL display the workspace as a navigable directory tree with
expandable folders. Rendering MUST be virtualized so that only visible rows are
mounted, and the tree MUST remain responsive with several thousand entries.

#### Scenario: Tree reflects the workspace

- **WHEN** a workspace is open
- **THEN** its folders and files are shown in a tree, folders collapsible

#### Scenario: Rendering is virtualized

- **WHEN** a workspace with several thousand files is displayed
- **THEN** only the rows within the visible viewport are mounted in the DOM

#### Scenario: Scrolling stays smooth at scale

- **WHEN** the user scrolls a tree of several thousand entries
- **THEN** scrolling remains responsive

#### Scenario: Opening a file from the tree

- **WHEN** the user activates a `.md` file in the tree
- **THEN** that document opens

### Requirement: Fuzzy quick open

The system SHALL provide a quick open surface, invoked by keyboard shortcut, that
filters workspace files by fuzzy matching. Matching MUST run against an in-memory
listing in the frontend, without a backend round trip per keystroke.

#### Scenario: Filtering by fuzzy match

- **WHEN** the user opens quick open and types a partial, non-contiguous fragment
  of a file path
- **THEN** matching files are listed, ranked by match quality

#### Scenario: No backend call per keystroke

- **WHEN** the quick open implementation is inspected
- **THEN** typing filters a cached in-memory listing and issues no backend call

#### Scenario: Selecting a result opens it

- **WHEN** the user selects a result
- **THEN** that document opens and quick open closes

#### Scenario: Listing stays current

- **WHEN** a file is created or deleted externally while quick open is available
- **THEN** the next invocation reflects the change

### Requirement: Document preview

The system SHALL preview a document without mounting the editing engine, by
parsing it and rendering it through the reader. There MUST NOT be a second
rendering implementation for previews.

#### Scenario: Preview renders formatted content

- **WHEN** the user selects a `.md` file in the tree
- **THEN** its content is shown formatted

#### Scenario: Preview mounts no editor

- **WHEN** a preview is displayed
- **THEN** no ProseMirror editor instance is created for it

#### Scenario: Preview reuses the reader

- **WHEN** the preview implementation is inspected
- **THEN** it calls the same renderer used by reader mode

#### Scenario: Moving between files is fast

- **WHEN** the user moves the selection between files in the tree
- **THEN** each preview appears without a perceptible wait

### Requirement: Tabs for multiple open documents

The system SHALL allow several documents to be open at once, presented as tabs.
Each open document MUST retain its own undo history and caret position across tab
switches, which requires each to own its own editor instance.

#### Scenario: Opening a second document adds a tab

- **WHEN** a document is open and the user opens another
- **THEN** both are listed as tabs and the newly opened one is active

#### Scenario: Undo history survives a tab switch

- **WHEN** the user edits a document, switches to another tab, switches back and
  invokes undo
- **THEN** the edit is reversed, because the history was preserved

#### Scenario: Caret position survives a tab switch

- **WHEN** the user places the caret, switches tabs and returns
- **THEN** the caret is where it was left

#### Scenario: Closing a tab with unsaved changes

- **WHEN** the user closes a tab whose document has unsaved changes
- **THEN** the user is asked before the document is discarded

#### Scenario: Dirty state is shown per tab

- **WHEN** one open document has unsaved changes and another does not
- **THEN** only the dirty one is marked as such in the tab strip

### Requirement: Large-document and workspace performance is measurable

The project SHALL provide a repeatable performance evaluation for opening and rendering a representative large Markdown document and scanning/navigating a workspace containing several thousand entries. The evaluation MUST record workload size, hardware and operating-system context, cold and warm timings where applicable, and whether normal UI interaction remains responsive during workspace scanning. Results MUST be documented, and any optimization MUST preserve the existing single-renderer and Markdown round-trip requirements.

#### Scenario: Measure large Markdown document open and render
- **WHEN** the performance evaluation is run against its checked-in or reproducibly generated large-document fixture
- **THEN** it records document size, block count, time to usable formatted view, and environment details

#### Scenario: Measure a large workspace
- **WHEN** the performance evaluation is run against a workspace with several thousand entries
- **THEN** it records scan completion and navigation responsiveness, including whether interactions can proceed while scanning

#### Scenario: Performance evaluation does not change saved Markdown
- **WHEN** a benchmark document is opened and saved without edits
- **THEN** its Markdown round-trip output remains unchanged

# document-session Specification

## Purpose
TBD - created by archiving change markdown-reader. Update Purpose after archive.
## Requirements
### Requirement: Opening a Markdown file from within the application

The system SHALL let the user open a `.md` file through a native file dialog. The
file MUST be read from disk, parsed through the core parser, and displayed in
reader mode.

#### Scenario: Opening a valid document

- **WHEN** the user chooses a `.md` file in the open dialog
- **THEN** the file is read, parsed and displayed formatted in reader mode
- **AND** the window title shows the file name

#### Scenario: Cancelling the dialog

- **WHEN** the user dismisses the open dialog without choosing a file
- **THEN** the currently open document, if any, remains unchanged

#### Scenario: Unreadable file

- **WHEN** the selected file cannot be read because it does not exist or
  permission is denied
- **THEN** the application reports the failure to the user and remains usable

#### Scenario: Document opens in reader mode by default

- **WHEN** any document is opened
- **THEN** the active mode is `reader`

### Requirement: Opening a file handed over by the operating system

The system SHALL accept a file path passed as a process argument at startup and
open that document. The path MUST be read on the Rust side and delivered to the
frontend, since process arguments are not reachable from the webview.

#### Scenario: Launched with a file argument

- **WHEN** the application is started with a path to a `.md` file as an argument
- **THEN** that document is opened in reader mode once the frontend is ready

#### Scenario: Launched with no argument

- **WHEN** the application is started with no file argument
- **THEN** it opens to its empty state without error

#### Scenario: Launched with an invalid path

- **WHEN** the application is started with a path that does not exist
- **THEN** it opens to its empty state and reports that the file could not be opened

### Requirement: Session state ownership

Session state SHALL hold the collection of open documents and which one is active.
Each open document holds its file path, the parsed document, its mode, its outline
and its dirty flag. When the editor is introduced, ownership of the editable document
MUST move to ProseMirror and the session MUST retain only the path, the dirty flag
and the mode, so that no duplicate source of truth for editable content exists.

#### Scenario: Session exposes what the shell needs

- **WHEN** a document is open
- **THEN** the active document's file path, parsed tree, mode and outline are all
  readable from a single session store

#### Scenario: Opening a second document adds it alongside the first

- **WHEN** a document is open and the user opens a different file
- **THEN** both documents are held by the session, the new one is active, and the
  session reflects its file path, tree and outline

#### Scenario: Reopening an open document activates it

- **WHEN** the user opens a file that is already open
- **THEN** that document becomes active and keeps its unsaved edits, rather than
  being reloaded

#### Scenario: No duplicated editable document

- **WHEN** the editor is introduced in a later change
- **THEN** the session store no longer holds the editable document content, and
  ProseMirror is its only owner


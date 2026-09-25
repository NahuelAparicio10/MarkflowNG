# workspace Specification

## Purpose
Opening a folder as the working root, scanning it in Rust, keeping the file listing current through a debounced filesystem watcher, and reacting to external changes to open documents without mistaking the application's own writes for them. Created by archiving change workspace-explorer.
## Requirements
### Requirement: Opening a folder as the workspace

The system SHALL let the user open a folder as the workspace root. The folder MUST
be scanned recursively on the Rust side and the resulting file listing delivered to
the frontend as a single payload rather than through per-entry calls.

#### Scenario: Opening a folder

- **WHEN** the user chooses a folder in the open-folder dialog
- **THEN** the folder becomes the workspace root and its contents are listed

#### Scenario: Scan runs in the backend

- **WHEN** the scan implementation is inspected
- **THEN** directory traversal happens in Rust and the listing crosses the bridge
  as one payload

#### Scenario: Large folder does not block the window

- **WHEN** a folder containing several thousand files is opened
- **THEN** the window remains responsive while the scan is in progress and the
  tree fills in as results arrive

#### Scenario: Unreadable folder

- **WHEN** the chosen folder cannot be read
- **THEN** the failure is reported and the application remains usable

### Requirement: Filesystem watching

The system SHALL watch the workspace for changes made outside the application and
report creations, modifications, renames and deletions. Events MUST be debounced
and coalesced in the backend before being emitted, so that a bulk change produces
a batch rather than one message per file.

#### Scenario: External creation appears in the tree

- **WHEN** a new `.md` file is created in the workspace by another program
- **THEN** it appears in the tree without the user rescanning

#### Scenario: External deletion is removed from the tree

- **WHEN** a file is deleted outside the application
- **THEN** it disappears from the tree

#### Scenario: Bulk change is coalesced

- **WHEN** hundreds of files change at once, as during a version control checkout
- **THEN** the frontend receives a batched update rather than one event per file

#### Scenario: Rename is reflected

- **WHEN** a file is renamed outside the application
- **THEN** the tree shows the new name and no longer shows the old one

### Requirement: The application ignores its own writes

The system SHALL distinguish filesystem events caused by its own saves from
genuine external changes, by recording the target path and expected content before
writing and matching incoming events against that record. It MUST NOT achieve this
by suspending the watcher during writes.

#### Scenario: Autosave produces no external-change notification

- **WHEN** autosave writes the open document
- **THEN** no external-change notification is raised for that document

#### Scenario: Watcher is never suspended

- **WHEN** the save implementation is inspected
- **THEN** it does not stop, pause or unsubscribe the watcher around the write

#### Scenario: A genuine change during a save is still detected

- **WHEN** another program modifies a different file while a save is in progress
- **THEN** that change is reported as external

### Requirement: Handling external changes to an open document

When a document open in the application is modified on disk, the system SHALL
reload it silently if it has no unsaved changes, and SHALL ask the user what to do
if it does. It MUST NOT discard unsaved work or overwrite external changes without
the user choosing.

#### Scenario: Clean document reloads silently

- **WHEN** the open document has no unsaved changes and is modified on disk
- **THEN** the document is reloaded from disk with no prompt

#### Scenario: Dirty document prompts

- **WHEN** the open document has unsaved changes and is modified on disk
- **THEN** the user is informed of the conflict and asked whether to keep the local
  version or reload from disk

#### Scenario: Nothing is lost without a choice

- **WHEN** a conflict is pending and the user has not answered
- **THEN** neither the in-memory document nor the file on disk is modified

#### Scenario: Open document deleted on disk

- **WHEN** the open document is deleted outside the application
- **THEN** the user is informed and the in-memory content is retained so it can be
  saved again

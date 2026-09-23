## MODIFIED Requirements

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

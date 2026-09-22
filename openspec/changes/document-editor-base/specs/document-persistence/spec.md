## ADDED Requirements

### Requirement: Saving a document to Markdown

The system SHALL save the open document by mapping the ProseMirror document to
mdast, serializing it with the core serializer, and writing the result to the
file. There MUST be exactly one save path, and it MUST NOT contain a shortcut that
writes previously read text back to disk without serializing.

#### Scenario: Explicit save writes the document

- **WHEN** the user invokes save on a modified document
- **THEN** the file on disk contains the serialized Markdown of the current
  document and the document is no longer marked dirty

#### Scenario: Save path goes through the core

- **WHEN** the save implementation is inspected
- **THEN** it calls `pmToMdast` and `serializeMarkdown`, with no branch that
  bypasses serialization

#### Scenario: Serialization failure does not write

- **WHEN** serialization throws while saving
- **THEN** no bytes are written to the target file and the failure is reported to
  the user

### Requirement: Byte-identical round-trip on disk

Opening a document and saving it without editing SHALL leave the file on disk
byte-identical. This guarantee MUST be verified end to end against real files, not
only at the mdast level.

#### Scenario: Untouched document produces an empty diff

- **WHEN** a normalized Markdown file is opened in the editor and saved without
  any edit
- **THEN** the bytes on disk are unchanged

#### Scenario: Verified against real documents

- **WHEN** the end-to-end suite runs
- **THEN** it covers at least one full real-world document from this repository,
  in addition to synthetic fixtures

#### Scenario: Content beyond the editable schema survives a save

- **WHEN** a document containing tables, code blocks or frontmatter is opened,
  edited elsewhere in the document, and saved
- **THEN** that content is present in the saved file, unchanged

### Requirement: Dirty state derived from content

The dirty flag SHALL be true when and only when the current document serializes to
bytes different from those last written to disk. It MUST NOT be set merely because
a transaction occurred.

#### Scenario: Edit marks the document dirty

- **WHEN** the user types a character into a saved document
- **THEN** the document is marked dirty and the indicator is visible

#### Scenario: Reverted edit clears dirty state

- **WHEN** the user types a character and then deletes it, restoring the original
  content
- **THEN** the document is no longer marked dirty

#### Scenario: Unedited document is never dirty

- **WHEN** a document is opened and not edited
- **THEN** it is not marked dirty, regardless of whether its formatting differs
  from the serializer normal form

### Requirement: Autosave

The system SHALL automatically save a dirty document after a period of inactivity.
Autosave MUST write atomically, by writing to a temporary file in the same
directory and renaming it over the target, and MUST NOT fire for a document that
is not dirty.

#### Scenario: Autosave persists changes after inactivity

- **WHEN** the user edits a document and then stops typing for the debounce interval
- **THEN** the document is saved and the dirty indicator clears

#### Scenario: Autosave does not fire while typing continuously

- **WHEN** the user types continuously for longer than the debounce interval
- **THEN** no save occurs until typing pauses

#### Scenario: Autosave skips clean documents

- **WHEN** the debounce timer elapses on a document that is not dirty
- **THEN** no write to disk occurs

#### Scenario: Interrupted write does not truncate the file

- **WHEN** a write fails partway through
- **THEN** the original file remains intact, because the target is only replaced
  by an atomic rename after the temporary file is fully written

#### Scenario: Explicit save is immediate

- **WHEN** the user invokes save explicitly
- **THEN** the document is written without waiting for the debounce interval

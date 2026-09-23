## ADDED Requirements

### Requirement: Image nodes

The system SHALL support images carrying a source, alternative text and an optional
title, and SHALL display them inline in both reader and editor modes.

#### Scenario: Image displays

- **WHEN** a document containing an image reference to an existing file is opened
- **THEN** the image is displayed

#### Scenario: Missing image is indicated

- **WHEN** an image reference points to a file that does not exist
- **THEN** a visible placeholder is shown and the reference is preserved in the
  document

#### Scenario: Alt text is editable and preserved

- **WHEN** the user sets alternative text on an image
- **THEN** it is stored and present in the serialized Markdown

#### Scenario: Image round-trips

- **WHEN** a document containing images completes a full round-trip
- **THEN** each image reference is unchanged in the serialized output

### Requirement: Inserting images

The system SHALL allow inserting an image by choosing a file, by pasting image data
from the clipboard, and by dragging a file onto the document.

#### Scenario: Insert by file dialog

- **WHEN** the user chooses an image file
- **THEN** an image node referencing that file is inserted at the caret

#### Scenario: Insert by drag and drop

- **WHEN** the user drops an image file onto the document
- **THEN** an image node referencing that file is inserted at the drop position

#### Scenario: Insert by paste

- **WHEN** the user pastes image data from the clipboard
- **THEN** the data is written to a file in the assets directory relative to the
  document, an image node referencing that file is inserted, and the user is told
  where the file was written

#### Scenario: Pasted data is never embedded inline

- **WHEN** an image is inserted by paste
- **THEN** the serialized Markdown contains a file reference and no base64 data URI

### Requirement: Image path resolution

Image paths SHALL be stored relative to the directory of the document that
references them when the target lies inside the workspace. Paths outside the
workspace and absolute URLs MUST be stored as given. Existing references MUST NOT be
rewritten when a document is opened or saved.

#### Scenario: Workspace image is stored relative to the document

- **WHEN** the user inserts an image located inside the workspace
- **THEN** the stored path is relative to the document's own directory

#### Scenario: Absolute URL is stored unchanged

- **WHEN** the user inserts an image by absolute URL
- **THEN** the stored reference is that URL, unchanged

#### Scenario: Existing references are not rewritten

- **WHEN** a document containing image references is opened and saved without
  editing those references
- **THEN** every reference is byte-identical to the original

#### Scenario: Document remains portable

- **WHEN** the workspace is cloned to a different location and a document with a
  relative image reference is opened
- **THEN** the image still resolves

### Requirement: Image display size

Display size SHALL be persisted only when the user has explicitly resized an image,
and MUST be encoded within the image title field so that the output remains valid
Markdown with no HTML. An image that has never been resized MUST NOT gain a title.

#### Scenario: Resizing persists the size

- **WHEN** the user resizes an image and saves
- **THEN** the size is present in the image title field and the image is displayed
  at that size when reopened

#### Scenario: Unresized image gains no title

- **WHEN** a document containing images that were never resized is saved
- **THEN** no title is added to any image reference

#### Scenario: Output stays clean Markdown

- **WHEN** a document containing a resized image is serialized
- **THEN** the output contains no HTML image tag and no non-Markdown syntax

#### Scenario: Foreign titles are preserved

- **WHEN** a document contains an image whose title was written by another tool and
  does not encode a size
- **THEN** the title is preserved unchanged through a round-trip

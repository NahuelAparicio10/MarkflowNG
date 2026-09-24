# ai-document-commands Specification

## Purpose
Provide reviewable AI operations over document selections while preserving schema, mapping, and transaction safeguards.

## Requirements

### Requirement: Commands operate on document structure

AI operations over a selection SHALL produce document structure, not raw text
inserted into the document. The model response MUST be parsed with the core parser,
mapped through the existing mapping, and applied as a single ProseMirror
transaction, so that schema validation, position mapping and undo all apply.

#### Scenario: Result becomes validated structure

- **WHEN** an AI command returns content containing a heading and a list
- **THEN** the applied result is a heading node and a list node, not a paragraph
  containing literal Markdown syntax

#### Scenario: Applied as one transaction

- **WHEN** an AI result is accepted and the user then presses undo once
- **THEN** the document returns to its state before the operation

#### Scenario: Invalid output does not corrupt the document

- **WHEN** a model response parses into structure the schema rejects
- **THEN** the operation is reported as failed, the document is unchanged, and the
  raw response remains available to the user

#### Scenario: Result goes through the existing mapping

- **WHEN** the implementation is inspected
- **THEN** it calls the core parser and the existing mapping, with no separate
  conversion path

### Requirement: Selection commands

The system SHALL provide operations over a selection, including rewrite,
summarize, expand, convert to table and convert to list.

#### Scenario: Rewriting a selection

- **WHEN** the user selects a paragraph and invokes rewrite
- **THEN** a suggested replacement is produced for review

#### Scenario: Converting a list to a table

- **WHEN** the user selects a list and invokes convert to table
- **THEN** a table is produced for review, with the list content distributed across
  cells

#### Scenario: Commands require a selection

- **WHEN** a selection command is invoked with an empty selection
- **THEN** the command is unavailable rather than operating on the whole document

### Requirement: Review before applying

No AI operation SHALL modify the document without the user accepting it. The
proposed result MUST be shown as a diff against the current selection, showing
removals as well as additions, with accept and reject available.

#### Scenario: Result is shown before it applies

- **WHEN** an AI command returns a result
- **THEN** the document is not yet modified and a diff is presented

#### Scenario: Rejecting leaves the document untouched

- **WHEN** the user rejects a suggestion
- **THEN** the document is byte-identical to its state before the command ran

#### Scenario: Removals are visible

- **WHEN** a suggestion omits content present in the selection
- **THEN** the diff shows that content as removed rather than presenting only the
  new text

#### Scenario: Accepting applies the transaction

- **WHEN** the user accepts a suggestion
- **THEN** the change is applied as one transaction and the document is marked dirty

### Requirement: Generative commands in the existing command menu

Generative commands SHALL be contributed to the command registry introduced for the
slash menu, rather than through a separate menu. Their availability predicate MUST
exclude them when no provider is configured.

#### Scenario: Opening commands over a selection

- **WHEN** the user presses Ctrl/Cmd+Shift+Space with a non-empty selection
- **THEN** the existing command menu opens, preserving that selection, and filtering
  changes only menu state, not document content
- **AND** Escape dismisses it without changing the document
- **AND** changing the selection or editing the document dismisses the menu

#### Scenario: Commands appear in the slash menu

- **WHEN** a provider is configured and the slash menu is opened
- **THEN** generative commands are listed alongside insertion commands

#### Scenario: No parallel menu was introduced

- **WHEN** the implementation is inspected
- **THEN** generative commands are registered through the existing registry and no
  second menu component exists

#### Scenario: Pending state during execution

- **WHEN** a generative command is running
- **THEN** the menu indicates that it is in progress, using the asynchronous
  contract already defined

### Requirement: Selection commands work without a workspace

AI selection commands SHALL be available for an open standalone Markdown document when a provider is configured, without requiring the containing folder to be opened as a workspace. The existing parser, mapping, review, and transaction safeguards MUST remain in effect.

#### Scenario: Run a selection command in a standalone document
- **WHEN** a provider is configured, a Markdown file is open without a workspace, and the user invokes an AI command on a non-empty selection
- **THEN** Markflow generates a suggestion for that selection and presents it for review

#### Scenario: No provider is configured
- **WHEN** a standalone document is open without a configured provider
- **THEN** generative commands are unavailable and the interface provides an actionable route to provider settings

# command-menu Specification

## Purpose
The slash-triggered insertion menu: opening on a slash in an empty paragraph, a single command registry that other modules contribute entries to, filtering by label and keyword with full keyboard operation, an entry for every insertable block type, and dismissal and undo that always leave the literal typed text recoverable. Created by archiving change slash-commands.
## Requirements

### Requirement: Slash trigger

The system SHALL open the command menu when the user types a forward slash at the
start of an empty block. It MUST NOT open on a slash typed elsewhere in the text,
so that ordinary technical writing containing paths and URLs is unaffected.

#### Scenario: Menu opens in an empty block

- **WHEN** the user types a forward slash at the start of an empty paragraph
- **THEN** the command menu opens

#### Scenario: Menu does not open mid-sentence

- **WHEN** the user types a forward slash while writing a file path inside a
  sentence
- **THEN** the menu does not open and the slash is inserted as text

#### Scenario: Menu does not open in a code block

- **WHEN** the user types a forward slash inside a code block
- **THEN** the menu does not open

### Requirement: Command registry

Commands SHALL be declared in a single registry rather than enumerated inside the
menu component. Each command MUST declare an identifier, a label, keywords, a
group, an availability predicate and an action. The action signature MUST be
asynchronous so that commands performing work over time are supported without
changing the contract.

#### Scenario: Menu renders from the registry

- **WHEN** the menu is opened
- **THEN** the entries shown are those held by the registry

#### Scenario: Unavailable commands are hidden

- **WHEN** a command's availability predicate returns false in the current context
- **THEN** that command is not shown in the menu

#### Scenario: Actions are asynchronous by contract

- **WHEN** the command contract is inspected
- **THEN** the action returns a promise, and a synchronous command satisfies it by
  resolving immediately

#### Scenario: Commands can be contributed from other modules

- **WHEN** a module outside the menu registers a command
- **THEN** it appears in the menu without modifying the menu component

### Requirement: Filtering and keyboard interaction

The menu SHALL filter as the user continues typing, matching against both labels
and keywords, and MUST be fully operable from the keyboard.

#### Scenario: Filtering by label

- **WHEN** the user types a fragment of a command label after the trigger
- **THEN** only matching commands remain listed

#### Scenario: Filtering by keyword

- **WHEN** the user types a keyword associated with a command but not present in
  its label
- **THEN** that command is listed

#### Scenario: Arrow keys move the selection

- **WHEN** the menu is open and the user presses the down arrow
- **THEN** the selected entry moves down, and the editor caret does not move

#### Scenario: Enter runs the selected command

- **WHEN** the menu is open and the user presses Enter
- **THEN** the selected command runs and no new block is created by the Enter key

#### Scenario: Bindings are released on close

- **WHEN** the menu closes
- **THEN** the arrow keys and Enter behave as normal editor bindings again

### Requirement: Insertion commands

The menu SHALL offer an entry for every block type that can be inserted, including
headings of each level, bulleted list, numbered list, task list, blockquote, code
block, table, image and horizontal rule.

#### Scenario: Inserting a block from the menu

- **WHEN** the user selects the table entry
- **THEN** a table is inserted at the caret and the menu closes

#### Scenario: Every insertable block is reachable

- **WHEN** the menu is opened with no filter in an empty paragraph
- **THEN** every block type listed in this requirement is present

### Requirement: Clean abandonment and undo

Dismissing the menu SHALL leave the literal text the user typed in the document.
Running a command MUST replace the trigger text and insert the block in a single
transaction, so that one undo returns the document to that literal text.

#### Scenario: Escape leaves the typed text

- **WHEN** the menu is open and the user presses Escape
- **THEN** the menu closes and the slash and any typed filter remain as plain text

#### Scenario: No match leaves the typed text

- **WHEN** the user types a filter matching no command
- **THEN** the menu closes and the typed text remains in the document

#### Scenario: Single undo after insertion

- **WHEN** a command inserts a block and the user presses undo once
- **THEN** the document shows the literal trigger text the user typed, not an
  intermediate state

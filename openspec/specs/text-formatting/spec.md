# text-formatting Specification

## Purpose
Inline formatting — strong, emphasis, strikethrough, inline code and links — applied through keyboard shortcuts, Markdown input rules and a link affordance, without exposing Markdown syntax in the editor. Created by archiving change inline-block-formatting.
## Requirements
### Requirement: Inline formatting marks

The system SHALL support the inline marks strong, emphasis, strikethrough and
inline code. Applying a mark MUST change the appearance of the selected text
without exposing Markdown syntax characters in the editor.

#### Scenario: Applying a mark to a selection

- **WHEN** the user selects text and applies the strong mark
- **THEN** the selected text is displayed in bold and no asterisks are visible

#### Scenario: Toggling a mark off

- **WHEN** the user applies the strong mark to text that already carries it
- **THEN** the mark is removed from the selection

#### Scenario: Overlapping marks

- **WHEN** text carries both the strong and emphasis marks
- **THEN** both are displayed, and a round-trip preserves both

#### Scenario: Marks round-trip

- **WHEN** a document containing strong, emphasis, strikethrough and inline code
  completes a full round-trip through the editor and back to Markdown
- **THEN** the serialized output is equivalent to the input

### Requirement: Keyboard shortcuts for formatting

The system SHALL provide keyboard shortcuts for the inline marks, following
platform conventions. Shortcuts MUST be declared in a single module so that
conflicts are resolved in one place.

#### Scenario: Bold shortcut

- **WHEN** the user selects text and presses the bold shortcut
- **THEN** the strong mark is applied to the selection

#### Scenario: Shortcut with no selection

- **WHEN** the user presses a mark shortcut with an empty selection and then types
- **THEN** the newly typed text carries the mark

#### Scenario: Shortcuts declared centrally

- **WHEN** the codebase is inspected for keyboard shortcut bindings
- **THEN** the editor shortcut table is defined in a single module

### Requirement: Input rules for Markdown syntax

The system SHALL convert Markdown syntax into formatted content as the user types.
Each conversion MUST be applied as a single transaction, so that one undo returns
the document to the literal text the user typed.

#### Scenario: Heading input rule

- **WHEN** the user types a hash character followed by a space at the start of an
  empty paragraph
- **THEN** the paragraph becomes a heading of level one and no hash is visible

#### Scenario: Emphasis input rule

- **WHEN** the user types text delimited by double asterisks
- **THEN** the delimited text becomes bold and the asterisks are removed

#### Scenario: Single undo restores the typed text

- **WHEN** an input rule converts typed syntax and the user presses undo once
- **THEN** the document shows the literal syntax the user typed, not a partially
  unwound state

#### Scenario: Conversion can be disabled

- **WHEN** automatic conversion is disabled in settings and the user types Markdown
  syntax
- **THEN** the text remains literal and no conversion occurs

### Requirement: Links

The system SHALL support links as an inline mark carrying a target. Because a link
cannot be created by typing text alone, the system MUST provide an explicit
affordance to create and to edit a link target.

#### Scenario: Creating a link from a selection

- **WHEN** the user selects text and invokes the link affordance with a URL
- **THEN** the selection becomes a link to that URL, displayed as link text

#### Scenario: Editing an existing link target

- **WHEN** the caret is inside an existing link and the user invokes the link
  affordance
- **THEN** the current target is shown and can be changed

#### Scenario: Pasting a URL over a selection

- **WHEN** the user pastes a URL while text is selected
- **THEN** the selected text becomes a link to the pasted URL, rather than being
  replaced by the URL text

#### Scenario: Removing a link

- **WHEN** the user removes the link from linked text
- **THEN** the text remains and the link mark is gone

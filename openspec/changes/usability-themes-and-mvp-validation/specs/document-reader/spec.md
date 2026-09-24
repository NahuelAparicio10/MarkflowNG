## MODIFIED Requirements

### Requirement: Document outline

The system SHALL derive a navigable outline from the document headings. Selecting
an entry MUST scroll the document to that heading, and the entry corresponding to
the topmost visible heading MUST be indicated as active. The outline SHALL appear
in a panel on the left and SHALL be open by default when a document is opened. A
visible control beneath the main toolbar MUST allow the user to collapse the panel
toward the left or reopen it; the user's visibility choice SHALL persist.

#### Scenario: Outline reflects heading structure

- **WHEN** a document containing nested headings is opened
- **THEN** the outline lists every heading in document order, indented by level

#### Scenario: Clicking an entry navigates

- **WHEN** the user selects an outline entry
- **THEN** the document scrolls so that the corresponding heading is visible

#### Scenario: Active entry follows scrolling

- **WHEN** the user scrolls the document so a different heading becomes topmost
- **THEN** the outline marks that heading as the active entry

#### Scenario: Document without headings

- **WHEN** a document containing no headings is opened
- **THEN** the outline is empty and does not error

#### Scenario: Outline is initially visible

- **WHEN** a document is opened and the user has not collapsed the outline
- **THEN** the outline is visible on the left

#### Scenario: Outline can be collapsed and restored

- **WHEN** the user activates the outline control below the main toolbar
- **THEN** the left panel collapses, and activating the control again reopens it

#### Scenario: Outline visibility persists

- **WHEN** the user changes outline visibility and restarts the application
- **THEN** the previously selected visibility state is restored

### Requirement: View mode switching

The system SHALL model the active view as a single mode value with the states
`reader`, `raw` and `editor`, and MUST NOT represent it as independent boolean
flags. Switching modes MUST be available through a keyboard shortcut and through
a visible, labeled control in the application toolbar.

#### Scenario: Mode is a single value

- **WHEN** the session state is inspected
- **THEN** exactly one mode is active and no combination of flags can represent
  two modes simultaneously

#### Scenario: Keyboard shortcut toggles mode

- **WHEN** the user presses the mode-switch shortcut in reader mode
- **THEN** the view changes mode without reloading the document

#### Scenario: Visible control enters edit mode

- **WHEN** a document is in reader mode and the user activates the labeled Edit control
- **THEN** the document switches to editor mode without reloading or losing its position

#### Scenario: Visible control returns to reader mode

- **WHEN** a document is in editor mode and the user activates the labeled Read control
- **THEN** the document switches to reader mode without discarding edits

#### Scenario: Scroll position is preserved

- **WHEN** the user switches from reader to raw mode and back
- **THEN** the document is still open and no content has been altered

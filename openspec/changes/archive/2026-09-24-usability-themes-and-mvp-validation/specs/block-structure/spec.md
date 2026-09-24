## ADDED Requirements

### Requirement: Portable warning callouts

The system SHALL insert and render warning callouts using the GitHub-style blockquote form `> [!WARNING]` rather than arbitrary HTML text colors. Opening and saving a callout MUST preserve portable Markdown through the existing parser and mapping.

#### Scenario: Insert warning callout
- **WHEN** the user activates the Warning callout control in an editable paragraph
- **THEN** the paragraph becomes a warning block represented as a blockquote beginning with `[!WARNING]`

#### Scenario: Render existing warning callout
- **WHEN** a document contains a blockquote beginning with `[!WARNING]`
- **THEN** reader and editor give the block a distinct warning presentation without executing HTML

#### Scenario: Warning callout round-trips
- **WHEN** a warning callout is opened and saved without editing
- **THEN** its portable blockquote Markdown remains unchanged

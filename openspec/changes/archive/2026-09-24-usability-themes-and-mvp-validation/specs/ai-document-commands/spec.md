## ADDED Requirements

### Requirement: Selection commands work without a workspace

AI selection commands SHALL be available for an open standalone Markdown document when a provider is configured, without requiring the containing folder to be opened as a workspace. The existing parser, mapping, review, and transaction safeguards MUST remain in effect.

#### Scenario: Run a selection command in a standalone document
- **WHEN** a provider is configured, a Markdown file is open without a workspace, and the user invokes an AI command on a non-empty selection
- **THEN** Markflow generates a suggestion for that selection and presents it for review

#### Scenario: No provider is configured
- **WHEN** a standalone document is open without a configured provider
- **THEN** generative commands are unavailable and the interface provides an actionable route to provider settings

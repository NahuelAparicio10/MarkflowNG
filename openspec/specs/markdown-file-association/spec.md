# markdown-file-association Specification

## Purpose
Allow the installed Windows application to open associated Markdown files safely through the existing document-loading path.

## Requirements

### Requirement: Open Markdown files from the operating system

The Windows application bundle SHALL register `.md` files as a supported file type. When Markflow is launched by the operating system with a Markdown file path, it MUST open that document in reader mode through the existing file-loading path.

#### Scenario: Installed app is launched with a Markdown file
- **WHEN** the user opens a `.md` file with Markflow from Windows Explorer
- **THEN** Markflow opens the requested document in reader mode

#### Scenario: Startup path points to a missing file
- **WHEN** Markflow receives a Markdown startup path that no longer exists
- **THEN** the application remains usable and presents a clear file-not-found message

#### Scenario: Opening an associated file preserves its contents
- **WHEN** a Markdown file is opened from the operating system and saved without edits
- **THEN** the existing Markdown round-trip behavior preserves the file contents

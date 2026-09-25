## MODIFIED Requirements

### Requirement: Open Markdown files from the operating system

The Windows application bundle SHALL register `.md` files as a supported file type and SHALL report whether Windows currently selects Markflow as the effective default. Every operating-system activation MUST canonicalize and validate an existing Markdown path in Rust, grant only that exact file to the fs scope, and open it in reader mode through the existing loading path. This behavior MUST work both on cold launch and when Windows forwards a later file to an already-running Markflow instance; activation events MUST be queued until the frontend is ready.

#### Scenario: Installed app is launched with a Markdown file
- **WHEN** the user opens a `.md` file with Markflow from Windows Explorer while Markflow is not running
- **THEN** Markflow authorizes the exact file and opens the requested document in reader mode without a forbidden-path error

#### Scenario: Explorer opens a file in the running application
- **WHEN** Markflow is already running and the user opens another `.md` file with Markflow from Explorer
- **THEN** the existing application instance receives, authorizes, and opens that file

#### Scenario: Startup path contains spaces or non-ASCII characters
- **WHEN** Explorer provides a valid Markdown path containing spaces or non-ASCII characters
- **THEN** Markflow receives the complete path and opens the correct file

#### Scenario: Startup path points to a missing file
- **WHEN** Markflow receives a Markdown startup path that no longer exists
- **THEN** the application remains usable and presents a clear file-not-found message

#### Scenario: Startup path is not Markdown
- **WHEN** an operating-system activation provides a non-Markdown file, directory, flag, or malformed path
- **THEN** Markflow rejects it without broadening the fs scope and remains usable

#### Scenario: Another default application overrides registration
- **WHEN** installer registration exists but Windows `UserChoice` selects another application for `.md`
- **THEN** Markflow explains that it is not the effective default and provides a guided Windows-supported path to choose Markflow without rewriting `UserChoice`

#### Scenario: Opening an associated file preserves its contents
- **WHEN** a Markdown file is opened from the operating system and saved without edits
- **THEN** the existing Markdown round-trip behavior preserves the file contents byte-for-byte

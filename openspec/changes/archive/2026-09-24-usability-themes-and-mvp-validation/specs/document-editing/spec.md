## ADDED Requirements

### Requirement: Formatting features are discoverable

The editor SHALL expose all Markdown formatting and block operations supported by its schema through a visible toolbar. The toolbar MUST include paragraph and heading levels 1–6, bold, italic, strikethrough, inline code, link, blockquote, fenced code block with language, bulleted, numbered and task lists, horizontal rule, table, image, undo, and redo. Controls MUST expose active and disabled state without duplicating the document state outside ProseMirror.

#### Scenario: User discovers formatting without knowing shortcuts
- **WHEN** the user enters editor mode
- **THEN** visible controls expose the supported inline, block, insertion, and history operations

#### Scenario: Active formatting is visible
- **WHEN** the selection is inside bold text or a heading
- **THEN** the corresponding toolbar control indicates its active state

#### Scenario: User changes code language
- **WHEN** the selection is in a fenced code block and the user chooses `shell`
- **THEN** the block language becomes `shell` and serializes in the Markdown fence info string

### Requirement: Keyboard shortcuts are explained

Formatting controls SHALL provide accessible names and tooltips that include keyboard shortcuts where available. The application SHALL provide a help surface listing keyboard shortcuts and explaining that `/` opens the insertion command menu.

#### Scenario: Hovering a formatting icon
- **WHEN** the user hovers or focuses the Bold control
- **THEN** the interface identifies it as Bold and shows its keyboard shortcut

#### Scenario: Opening keyboard help
- **WHEN** the user activates the keyboard-help control
- **THEN** the application lists supported shortcuts and the slash-command invocation

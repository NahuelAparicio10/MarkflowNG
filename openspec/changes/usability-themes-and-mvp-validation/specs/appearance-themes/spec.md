## ADDED Requirements

### Requirement: Selectable visual themes

The system SHALL provide Dark, Light, and Sepia themes, SHALL use Dark on first launch, and SHALL persist the user's selected theme on the device. Theme styling MUST use shared semantic tokens across the reader, editor, navigation, AI surfaces, and dialogs.

#### Scenario: First launch uses dark theme
- **WHEN** the application starts without a saved theme preference
- **THEN** the interface uses the Dark theme

#### Scenario: User changes theme
- **WHEN** the user selects Light or Sepia in appearance settings
- **THEN** all application surfaces update to that theme and the choice remains after restart

#### Scenario: Theme is consistent across document modes
- **WHEN** the user switches between reader, raw, and editor modes
- **THEN** the selected theme remains consistent and shared typography remains unchanged

### Requirement: Clear interactive control states

Interactive controls SHALL have visually distinguishable default, hover, keyboard-focus, pressed/selected, and disabled states. Keyboard focus MUST remain visible in every theme, and disabled controls MUST communicate why they are unavailable when the reason is actionable.

#### Scenario: Pointer hover communicates interactivity
- **WHEN** the pointer moves over an enabled button or menu item
- **THEN** its hover appearance distinguishes it from static text

#### Scenario: Keyboard focus is visible
- **WHEN** a user navigates controls using the keyboard
- **THEN** the focused control has a visible focus indicator in the active theme

#### Scenario: Unavailable AI action explains its prerequisite
- **WHEN** workspace Q&A is unavailable because no workspace is open
- **THEN** the interface explains that opening a folder is required instead of presenting an unexplained disabled action

### Requirement: Compact icon-led application chrome

The application SHALL present frequent actions with recognizable icons, accessible names, and tooltips rather than a row of undifferentiated text buttons. Appearance controls MUST be located at the top right. Icons MUST NOT be the sole accessible label.

#### Scenario: Appearance control placement
- **WHEN** the main application toolbar is displayed
- **THEN** an appearance icon is available at the top right and opens Dark, Light, and Sepia choices

#### Scenario: Icon remains accessible
- **WHEN** assistive technology inspects an icon-only action
- **THEN** the action has a descriptive accessible name and tooltip

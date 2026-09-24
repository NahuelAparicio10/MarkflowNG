## ADDED Requirements

### Requirement: Provider configuration is device-wide

The system SHALL store provider and model preferences as device-level settings rather than requiring one configuration per workspace. Credentials MUST remain in the operating system credential store and MUST NOT be copied into frontend persistence during migration.

#### Scenario: Configure provider without an open workspace
- **WHEN** the user opens provider settings while a standalone document is open and no workspace is open
- **THEN** the user can configure a provider and model for this device

#### Scenario: Device configuration applies to standalone documents
- **WHEN** a provider is configured and the user invokes a selection command in a standalone document
- **THEN** the command uses the device-level provider configuration

#### Scenario: Remote consent remains explicit
- **WHEN** the user configures a remote device-level provider
- **THEN** the interface explains the content that may be transmitted and requires explicit consent before enabling it

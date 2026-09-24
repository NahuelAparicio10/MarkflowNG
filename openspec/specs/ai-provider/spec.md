# ai-provider Specification

## Purpose
Define provider abstraction, configuration, consent, and secure credential handling for local and remote AI features.

## Requirements

### Requirement: Provider abstraction

The system SHALL talk to language models through a single provider interface
supporting both a remote API and a locally running model. Application code MUST NOT
depend on a specific vendor.

#### Scenario: Switching providers

- **WHEN** the user changes the configured provider in settings
- **THEN** subsequent operations use the new provider with no other change in
  behavior

#### Scenario: No vendor coupling

- **WHEN** the AI feature code is inspected
- **THEN** it depends on the provider interface, and vendor-specific code is
  confined to provider implementations

#### Scenario: Provider failure is reported

- **WHEN** a provider request fails because of a network error, an invalid
  credential or an unavailable local model
- **THEN** the failure is reported to the user, the document is unchanged, and the
  application remains usable

### Requirement: No provider configured by default

The system SHALL ship with no provider configured. Configuring a remote provider
MUST be an explicit user action, and the system MUST state what data will be
transmitted at the moment of configuration.

#### Scenario: Default state sends nothing

- **WHEN** the application is used without a provider having been configured
- **THEN** no document content leaves the machine

#### Scenario: AI commands are absent when unconfigured

- **WHEN** no provider is configured and the command menu is opened
- **THEN** no generative command is listed, because the availability predicate
  excludes them

#### Scenario: Remote configuration states what is sent

- **WHEN** the user configures a remote provider
- **THEN** the interface states what content will be transmitted before the setting
  takes effect

#### Scenario: Active remote provider is visible

- **WHEN** a remote provider is configured and active
- **THEN** the interface indicates this persistently, not only in settings

### Requirement: Credentials are stored securely

Provider credentials SHALL be stored using the operating system credential store
and MUST NOT be written to the workspace, to the document, or to any file tracked
by version control.

#### Scenario: Credential is not written to the workspace

- **WHEN** the user enters an API credential
- **THEN** it is stored in the operating system credential store and no file in the
  workspace contains it

#### Scenario: Credential is not logged

- **WHEN** provider requests are logged or errors are reported
- **THEN** the credential does not appear in the output

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

# opencode-ai-bridge Specification

## Purpose
Define a restricted integration with a compatible local OpenCode service for account, model, authorization, and generation access without exposing credentials or unrelated OpenCode capabilities.

## Requirements

### Requirement: Use supported OpenCode provider accounts

The system SHALL offer an optional OpenCode V2 provider that uses accounts and local runtimes connected through a compatible local OpenCode service. Markflow MUST NOT read, copy, persist, or expose OpenCode provider credentials or its credential database.

#### Scenario: Existing eligible account is available
- **WHEN** a compatible local OpenCode service has an active OAuth-connected account and usable model
- **THEN** Markflow lists that model without asking the user for an API key

#### Scenario: Local model is available
- **WHEN** OpenCode discovers a compatible local Ollama or LM Studio completion model
- **THEN** Markflow allows the user to select it without an API credential

#### Scenario: OpenCode is unavailable
- **WHEN** OpenCode is missing, stopped, incompatible, or unreachable
- **THEN** Markflow remains usable, explains the condition, and offers existing local/direct provider alternatives

### Requirement: Connect accounts through supported methods

Markflow SHALL display authentication methods reported by OpenCode and MAY initiate OpenCode's supported OAuth or device flow. OAuth tokens and refresh behavior MUST remain owned by OpenCode, and Markflow MUST NOT automate provider web pages or import credentials from OpenCode, Warp, browsers, or other applications.

#### Scenario: OAuth method is offered
- **WHEN** OpenCode reports an OAuth method for a provider and the user chooses it
- **THEN** Markflow opens or presents the authorization URL/code and reports completion from the OpenCode attempt state

#### Scenario: Provider does not offer supported OAuth
- **WHEN** no supported OAuth or account method is reported
- **THEN** Markflow does not fabricate a login flow and instead explains the available local or key-based methods

#### Scenario: User cancels authorization
- **WHEN** the user cancels an OAuth attempt
- **THEN** Markflow cancels the OpenCode attempt, stores no credential, and sends no document content

### Requirement: Restrict and validate the OpenCode bridge

The Rust backend SHALL expose only health, integration/account discovery, model discovery, authorization-attempt lifecycle, and generation operations required by Markflow. It MUST version-check the service, keep service authentication out of the webview, support cancellation, redact failures, and prevent arbitrary OpenCode filesystem, shell, session, plugin, or command access.

#### Scenario: Webview requests an unsupported OpenCode operation
- **WHEN** frontend input attempts to select a generic OpenCode API path or operation outside the allowlist
- **THEN** the backend rejects it before contacting the service

#### Scenario: Compatible generation succeeds
- **WHEN** the user has selected a discovered model, granted remote-content consent where required, and invokes an AI command
- **THEN** the bridge returns generated text through the existing review-before-apply flow

#### Scenario: Service version is incompatible
- **WHEN** the discovered OpenCode version is outside the tested compatibility range
- **THEN** Markflow disables the bridge with an actionable compatibility message and does not send content

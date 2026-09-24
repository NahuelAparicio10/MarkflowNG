## ADDED Requirements

### Requirement: AI can be validated without purchasing an API key

The provider settings SHALL include at least one supported no-manual-key path: an eligible account connected through OpenCode OAuth/device authorization or a discovered local model. Paid direct API credentials MUST remain optional for MVP acceptance testing.

#### Scenario: User chooses OpenCode
- **WHEN** the user selects the OpenCode provider option
- **THEN** Markflow discovers supported accounts/models or gives instructions to connect one without displaying an API-key field by default

#### Scenario: No zero-cost entitlement is available
- **WHEN** no connected account or local model grants usable generation
- **THEN** Markflow states that condition without charging, subscribing, or silently falling back to a paid endpoint

### Requirement: Provider connection can be tested safely

The settings interface SHALL provide a connection test that uses synthetic non-document content, reports the selected provider and model, supports cancellation, and distinguishes authentication, entitlement, compatibility, rate-limit, local-runtime, and network failures.

#### Scenario: Test succeeds
- **WHEN** the user tests a configured provider and the provider returns a valid response
- **THEN** Markflow marks the provider/model ready without reading or sending an open document

#### Scenario: Test fails
- **WHEN** authentication, entitlement, model availability, runtime, compatibility, or transport fails
- **THEN** Markflow shows an actionable category, leaves documents unchanged, and does not expose credentials or raw sensitive errors

### Requirement: AI readiness is honest

AI features SHALL remain labeled Beta until the connection test, selection-command flow, review-before-apply flow, and workspace retrieval flow have been exercised against their supported provider classes. The UI MUST distinguish account entitlement, local operation, and usage that may incur provider cost.

#### Scenario: Remote model may incur cost
- **WHEN** a discovered or directly configured model can bill usage
- **THEN** the model selection identifies that possibility before document content is sent

#### Scenario: Beta validation is incomplete
- **WHEN** a provider class has not passed the documented smoke test
- **THEN** the product does not describe that provider class as production-ready

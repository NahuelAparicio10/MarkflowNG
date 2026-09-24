## ADDED Requirements

### Requirement: Explain workspace prerequisite for retrieval

Workspace retrieval SHALL require an open workspace. When no workspace is open, the assistant MUST explain that a folder must be opened before workspace questions can be answered, while leaving standalone-document selection commands available when a provider is configured.

#### Scenario: Open assistant without a workspace
- **WHEN** the user opens the assistant while only a standalone document is open
- **THEN** the assistant explains that workspace questions require opening a folder and provides an action to open one

#### Scenario: Ask a workspace question after opening a workspace
- **WHEN** a workspace is open and indexed, and the user asks a question
- **THEN** the assistant retrieves workspace content and responds with navigable citations as specified by the existing retrieval requirements

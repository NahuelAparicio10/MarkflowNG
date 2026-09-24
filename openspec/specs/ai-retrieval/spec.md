# ai-retrieval Specification

## Purpose
Provide workspace-grounded conversational answers with navigable citations and explicit availability prerequisites.

## Requirements

### Requirement: Questions answered over the indexed workspace

The system SHALL allow the user to ask questions about the workspace and answer
them using content retrieved from the index.

#### Scenario: Answering from workspace content

- **WHEN** the user asks a question whose answer appears in an indexed document
- **THEN** the answer is produced using the relevant retrieved chunks

#### Scenario: Question with no relevant content

- **WHEN** the user asks a question with no relevant content in the workspace
- **THEN** the system states that it found nothing relevant rather than answering
  from outside the workspace without saying so

#### Scenario: Asking before the index is built

- **WHEN** the user asks a question while the initial index is still running
- **THEN** the system reports that indexing is incomplete and answers from what is
  indexed so far

### Requirement: Answers cite their sources

Every retrieval answer SHALL name the documents and sections it drew on, and each
citation MUST resolve to a location the user can open.

#### Scenario: Citations accompany the answer

- **WHEN** an answer is produced from retrieved content
- **THEN** it lists the source files and their section headings

#### Scenario: Citations are navigable

- **WHEN** the user activates a citation
- **THEN** the referenced document opens at the cited section

#### Scenario: Stale citation is handled

- **WHEN** a cited section no longer exists because the document changed
- **THEN** the document still opens and the user is told the section was not found

### Requirement: Conversational panel separate from inline commands

The system SHALL provide a panel for conversational use over the workspace,
distinct from the inline commands that operate on a selection.

#### Scenario: Panel does not modify documents on its own

- **WHEN** the user converses in the panel
- **THEN** no document is modified unless an explicit document command is invoked
  and reviewed

#### Scenario: Panel is unavailable without a provider

- **WHEN** no provider is configured
- **THEN** the panel indicates that a provider must be configured and offers no
  requests

#### Scenario: Panel state is peripheral

- **WHEN** the application state is inspected
- **THEN** panel state is held in the application store, not in the document, and
  is never serialized into a Markdown file

### Requirement: Explain workspace prerequisite for retrieval

Workspace retrieval SHALL require an open workspace. When no workspace is open, the assistant MUST explain that a folder must be opened before workspace questions can be answered, while leaving standalone-document selection commands available when a provider is configured.

#### Scenario: Open assistant without a workspace
- **WHEN** the user opens the assistant while only a standalone document is open
- **THEN** the assistant explains that workspace questions require opening a folder and provides an action to open one

#### Scenario: Ask a workspace question after opening a workspace
- **WHEN** a workspace is open and indexed, and the user asks a question
- **THEN** the assistant retrieves workspace content and responds with navigable citations as specified by the existing retrieval requirements

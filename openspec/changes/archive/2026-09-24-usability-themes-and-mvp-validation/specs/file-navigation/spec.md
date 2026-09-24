## ADDED Requirements

### Requirement: Large-document and workspace performance is measurable

The project SHALL provide a repeatable performance evaluation for opening and rendering a representative large Markdown document and scanning/navigating a workspace containing several thousand entries. The evaluation MUST record workload size, hardware and operating-system context, cold and warm timings where applicable, and whether normal UI interaction remains responsive during workspace scanning. Results MUST be documented, and any optimization MUST preserve the existing single-renderer and Markdown round-trip requirements.

#### Scenario: Measure large Markdown document open and render
- **WHEN** the performance evaluation is run against its checked-in or reproducibly generated large-document fixture
- **THEN** it records document size, block count, time to usable formatted view, and environment details

#### Scenario: Measure a large workspace
- **WHEN** the performance evaluation is run against a workspace with several thousand entries
- **THEN** it records scan completion and navigation responsiveness, including whether interactions can proceed while scanning

#### Scenario: Performance evaluation does not change saved Markdown
- **WHEN** a benchmark document is opened and saved without edits
- **THEN** its Markdown round-trip output remains unchanged

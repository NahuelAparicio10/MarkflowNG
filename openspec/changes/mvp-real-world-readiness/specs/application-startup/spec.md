## ADDED Requirements

### Requirement: Packaged startup is measurable

The application SHALL record local monotonic timing markers for process start, backend setup, webview readiness, first paint, startup-file authorization, parse completion, and initial document visibility. Measurements MUST use packaged release builds, identify cold versus warm runs, and MUST NOT transmit telemetry.

#### Scenario: Measure cold associated-file startup
- **WHEN** the packaged application is not running and Explorer launches an associated Markdown file
- **THEN** the validation output records each startup phase through visible reader content with machine and workload metadata

#### Scenario: Measure warm empty startup
- **WHEN** the packaged application starts without a file after a prior run
- **THEN** the validation output distinguishes warm timing and records time to an interactive empty window

### Requirement: Initial interaction does not wait for optional services

The application MUST defer provider restoration, AI service discovery, workspace indexing, update checks, and inactive editor initialization until after first paint unless one is strictly required by the initial user action. Failure of optional initialization MUST NOT delay or prevent opening a document.

#### Scenario: Open document while OpenCode is unavailable
- **WHEN** the application starts with an associated file and OpenCode discovery is slow or fails
- **THEN** the document becomes readable without waiting for OpenCode and the AI status updates later

#### Scenario: Startup regression threshold
- **WHEN** repeated packaged measurements establish a baseline and optimization target
- **THEN** automated or repeatable validation reports a regression when the agreed percentile exceeds its documented threshold

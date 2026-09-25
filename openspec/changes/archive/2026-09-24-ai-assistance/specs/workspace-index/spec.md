## ADDED Requirements

### Requirement: Chunking follows document structure

Documents SHALL be split for indexing at heading boundaries derived from the
parsed AST. Sections exceeding the size ceiling MUST be split further at block
boundaries and MUST NOT be split mid-block. Fixed-size character windows MUST NOT
be used.

#### Scenario: Sections become chunks

- **WHEN** a document with three headings is indexed
- **THEN** it produces chunks corresponding to those sections, each retaining its
  heading path

#### Scenario: Oversized section splits at block boundaries

- **WHEN** a section exceeds the size ceiling
- **THEN** it is split between blocks, and no chunk begins or ends inside a
  paragraph, list item or code block

#### Scenario: Document without headings

- **WHEN** a document containing no headings is indexed
- **THEN** it is chunked at block boundaries without error

#### Scenario: Chunks carry their location

- **WHEN** a chunk is stored
- **THEN** it records the file path and the heading path it came from

### Requirement: Local embeddings

Embeddings SHALL be computed on the local machine regardless of which provider is
configured for text generation. Document content MUST NOT be transmitted to a
remote service for the purpose of indexing.

#### Scenario: Indexing works without network access

- **WHEN** the workspace is indexed with no network connection available
- **THEN** indexing completes successfully

#### Scenario: Remote provider does not change indexing

- **WHEN** a remote text provider is configured and the workspace is indexed
- **THEN** no document content is sent to that provider as part of indexing

### Requirement: Background incremental indexing

Indexing SHALL run in the backend, off the user interface thread, and MUST be
incremental, reindexing only files reported as changed by the workspace watcher.

#### Scenario: Editing stays responsive during indexing

- **WHEN** a large workspace is being indexed
- **THEN** typing in the editor remains responsive

#### Scenario: Only changed files are reindexed

- **WHEN** a single file changes in an indexed workspace
- **THEN** only that file is reindexed

#### Scenario: Indexing can be paused

- **WHEN** the user pauses indexing
- **THEN** it stops and can be resumed without restarting from the beginning

#### Scenario: Progress is visible

- **WHEN** an initial index of a workspace is running
- **THEN** the interface reports progress

### Requirement: The index is a disposable local cache

The index SHALL be stored locally in SQLite and MUST be treated as a rebuildable
cache. It MUST NOT be the only home for any user content.

#### Scenario: Deleting the index is recoverable

- **WHEN** the index database is deleted
- **THEN** the application rebuilds it and no user content is lost

#### Scenario: Corrupt index recovers

- **WHEN** the index database is unreadable or its schema is outdated
- **THEN** it is discarded and rebuilt, and the failure does not prevent the
  application from opening documents

#### Scenario: Index holds no unique content

- **WHEN** the index contents are inspected
- **THEN** everything stored is derivable from the documents on disk

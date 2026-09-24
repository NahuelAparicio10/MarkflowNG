## Why

`Context/EXPLORE.md` names the AI layer as the differentiating part of the project,
and states the principle that separates it from a chat window bolted onto an
editor: the model operates on the AST, not on plain text. When it restructures a
section it returns nodes, applied as a ProseMirror transaction with undo, position
mapping and schema validation, rather than a string spliced in and hoped to fit.

The document AST is also what makes retrieval better here than in a generic tool.
Chunking by heading boundaries gives semantically coherent units for free, because
the author already marked them.

It lands last, as `EXPLORE.md` specifies, because it depends on a stable mapping.
Building it before phase 3 would mean building on foundations still changing.
Corresponds to **Fase 7** of `Context/EXPLORE.md`.

## What Changes

- Add a provider abstraction supporting both a remote API and a local model, with
  the choice in settings and no provider configured by default.
- Add commands over a selection: rewrite, summarize, expand, convert to table,
  convert to list. Results apply as ProseMirror transactions.
- Add a diff review step so every AI edit is shown before it is accepted, with
  accept and reject.
- Add background indexing of the workspace in Rust, chunked by AST heading
  boundaries, with local embeddings stored in SQLite.
- Add retrieval-augmented questions over the workspace, with answers citing the
  files and sections they came from.
- Add the generative commands to the slash menu registry from phase 6.
- Add an AI panel for conversational use, distinct from inline selection commands.

## Capabilities

### New Capabilities
- `ai-provider`: configuring and talking to a model provider, remote or local,
  including the case where none is configured.
- `ai-document-commands`: operations over a selection that return document
  structure and apply as reviewable transactions.
- `workspace-index`: background indexing of workspace documents, chunked by AST
  structure, with locally computed embeddings persisted for retrieval.
- `ai-retrieval`: answering questions over the indexed workspace with citations.

## Impact

- New code: `src/ai/`, indexing and embedding in `src-tauri/src/`, settings UI.
- New dependencies: an embedding runtime and a SQLite binding on the Rust side.
  Both are additions to `src-tauri`, not to the frontend.
- Depends on the mapping being stable, the slash registry from phase 6, and the
  workspace file listing from phase 4.
- Introduces the first configuration that can send document content off the
  machine. That has to be explicit, visible and off by default.
- Indexing is the first sustained background work in the product and must not
  interfere with editing.

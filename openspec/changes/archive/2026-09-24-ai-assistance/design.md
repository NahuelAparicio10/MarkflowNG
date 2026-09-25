## Context

Everything this layer needs now exists: a stable mapping, an AST for every open
document, a workspace file listing, and a command registry designed with
asynchronous contributed commands in mind.

Two things make this different from wrapping a chat API. The model's output becomes
document structure validated against the schema, not text pasted into a buffer. And
retrieval chunks on heading boundaries, which are semantic divisions the author
already made, rather than on character counts that cut mid-sentence.

The constraint that shapes the privacy decisions: this is a desktop editor holding
what may be unpublished design documents. Sending them anywhere must be a choice
the user makes knowingly.

## Goals / Non-Goals

**Goals:**
- Selection commands returning structure, applied as transactions.
- Every AI edit reviewable before it lands.
- Provider choice between remote and local, with neither assumed.
- Workspace indexing that does not interfere with editing.
- Retrieval answers that cite their sources.
- Generative commands in the existing slash menu.

**Non-Goals:**
- Exposing the workspace as an MCP server. `EXPLORE.md` places it after the MVP.
- Autonomous multi-step agents editing documents unattended.
- Training or fine-tuning anything.
- Cloud sync of the index. It is local, per machine.

## Decisions

### D1. Model output is parsed into mdast and applied as a transaction

The model returns Markdown, which is parsed with the core parser, mapped to
ProseMirror and applied as a single transaction over the selected range.

*Alternatives considered:*
- *Insert the returned text directly into the document.* Rejected: it produces a
  paragraph containing literal Markdown syntax, which is exactly what the product
  exists to avoid, and it bypasses schema validation entirely.
- *Have the model emit a structured JSON node format directly.* Rejected: models
  are far more reliable at Markdown than at an invented JSON schema, and the parser
  that turns Markdown into validated nodes already exists and is tested. Markdown is
  the interchange format the whole project is built around.

### D2. Every AI edit is reviewed before it applies

Results are shown as a diff against the current selection, with accept and reject.
No AI operation modifies the document without confirmation.

*Alternatives considered:* applying directly and relying on undo, which is
technically sufficient since D1 makes it a single transaction. Rejected because
undo requires the user to first notice that something wrong happened, and a
rewritten section can look plausible while having quietly dropped a sentence.
Review before apply is the difference between a tool that assists and one that has
to be watched.

### D3. No provider is configured by default, and remote providers are opt-in per workspace

The application ships with no provider. Choosing a remote one is an explicit action
that states what will be sent.

*Alternatives considered:* defaulting to a remote provider with an API key prompt.
Rejected on the product argument `EXPLORE.md` already makes: a desktop editor that
does not send your documents anywhere is a feature, and defaulting to transmission
forfeits it. The user should have to decide.

### D4. Embeddings are always computed locally, regardless of the text provider

Even when a remote provider handles generation, embeddings are computed on the
machine.

*Alternatives considered:* using a remote embedding API. Rejected for the reason
`EXPLORE.md` gives directly: indexing a workspace would then require network access
and incur a cost per document, on every reindex. It would also mean transmitting
every document in the workspace rather than only the ones the user asks about,
which is a much larger disclosure than the user is consenting to.

### D5. Chunking follows heading boundaries, not character counts

Documents are split at heading boundaries, with oversized sections split further at
block boundaries and never mid-block.

*Alternatives considered:* fixed-size overlapping character windows, the common
default. Rejected because it is a workaround for not having structure, and this
project does have structure. A heading marks a topic the author chose; a
seven-hundred-character window marks nothing. This is the concrete payoff of the
AST decision from `markdown-core`.

### D6. Indexing runs in Rust, off the UI thread, and is incremental

Indexing happens in the backend, driven by the phase 4 watcher, reindexing only
changed files.

*Alternatives considered:* indexing in the frontend during idle time. Rejected by
the explicit criterion in `EXPLORE.md`: work that blocks the UI thread belongs in
Rust, and workspace indexing is named as an example. Full reindexing on every
change is rejected as obviously wasteful once a workspace is large.

### D7. The index is a local SQLite database, and it is disposable

Embeddings and chunk metadata are stored in SQLite in the application data directory, and the
file is treated as a cache that can be deleted and rebuilt.

*Alternatives considered:* an in-memory index rebuilt at startup. Rejected because
it makes opening a large workspace slow every time. Treating it as disposable means
a corrupt or stale index is a recoverable inconvenience, never lost user data, so
it must never be the only home for anything.

### D8. Retrieval answers cite file and section, and citations are verifiable

Every answer names the documents and sections it drew on, resolvable to a location.

*Alternatives considered:* returning prose without attribution. Rejected because an
unattributed answer about your own documentation cannot be checked, and the section
metadata needed to attribute it is already in the index by construction under D5.

### D9. Generative commands are contributed to the phase 6 registry

They register through the existing extension point rather than adding a parallel
menu.

*Alternatives considered:* a separate AI menu. Rejected: the registry was designed
in phase 6 for exactly this, with asynchronous actions and availability predicates
already in the contract. Commands are simply unavailable when no provider is
configured.

### D10. Selection commands open the same menu without a typed trigger

Ctrl/Cmd+Shift+Space opens the existing command menu over a non-empty selection.
The selection is preserved, and filter text is held in plugin state rather than
inserted into the document. Escape dismisses without changing the document.
Selection changes or document edits dismiss the selection menu so an asynchronous
command cannot apply to a different range. Selection invocation uses the same
registry, component and pending-state contract as slash invocation. Slash typing
in an empty paragraph retains its existing insertion behavior.

This resolves the phase 6 constraint that slash invocation requires an empty
paragraph and a cursor, which otherwise makes selection-only commands unreachable.

### D11. Review complete responses

Selection results appear only after generation completes and schema validation
runs. The review shows the original selection as removed and the proposed
replacement as added. Acceptance is disabled for invalid output, while the raw
response remains available. This avoids accepting a moving, partial suggestion.
If the document, selection, or provider changes during the operation, the result
cannot be applied; the user must request a fresh suggestion.

### D12. Local generation uses a loopback llama.cpp server

The local provider uses llama.cpp's chat-completions endpoint, with a user-managed
model and server. Only literal loopback IP addresses are allowed, redirects are
disabled, and proxy settings are ignored. This adds no generative model binary to
Markflow. A CPU runtime and a small quantized instruction model are evaluated in
`evaluation.md`; larger models can be chosen without changing application code.

### D13. Embeddings use local ONNX inference and separate model provisioning

FastEmbed runs all-MiniLM-L6-v2 with mean pooling and one inference thread. It is
built without its hub/network integration. Model assets are downloaded explicitly
from a pinned public revision during setup, not during indexing or queries.
After setup, embeddings require only local files. An oversized indivisible block
is kept intact in the index even if its embedding reaches the tokenizer ceiling.

The disposable SQLite cache lives under application data, keyed by workspace path,
so no ignore-file edits or cache files are introduced into user workspaces. A
schema/model change requires a cache version bump. One low-priority Rust worker
owns inference, SQLite and the incremental queue. Pause takes effect between files;
resume keeps the queue. Queries run between indexed files and disclose incomplete
coverage. Initial indexing scans current files and compares content hashes to the
cache; subsequent changes come from the existing watcher.

## Risks / Trade-offs

- **The model returns Markdown that parses into structure the schema rejects, and
  the transaction fails** → The failure is caught and surfaced as a rejected
  suggestion rather than a crash, and the document is untouched because D2 means
  nothing was applied. The raw response remains available to the user.
- **A selection command silently drops content, and the user accepts it anyway** →
  Mitigated by D2's diff view, which shows removals explicitly rather than
  presenting only the new text.
- **Indexing a large workspace consumes significant CPU and battery** → Mitigated
  by D6's incremental reindexing, by running at low priority, and by making
  indexing something the user can pause.
- **A local embedding model adds a substantial binary to the application** →
  Accepted as the cost of D4. The size is measured and recorded during
  implementation, and the model can be downloaded on first use rather than bundled
  if it proves too large.
- **Retrieval quality is poor on small workspaces, where there is little to
  retrieve from** → Expected. Retrieval is presented as a workspace feature, and
  selection commands, which need no index, remain the primary path.
- **Sending document content to a remote provider surprises a user who did not
  read the setting** → Mitigated by D3's explicit opt-in, by naming what will be
  sent at the moment of configuration, and by a persistent indication in the
  interface when a remote provider is active.

## Migration Plan

Additive and inert until configured. With no provider set, AI commands are absent
from the menu and no index is built. Enabling a provider triggers the first
workspace index, which runs in the background and reports progress. Deleting the
index database causes a rebuild and loses nothing.

## Open Questions

- What is the right chunk size ceiling before a section is split further? To be
  measured against real documents.

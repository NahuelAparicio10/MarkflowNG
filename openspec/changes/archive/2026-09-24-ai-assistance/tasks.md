## 1. Provider abstraction

- [x] 1.1 Define the provider interface in `src/ai/provider/types.ts`, covering
      generation and error reporting
- [x] 1.2 Implement a remote provider behind that interface
- [x] 1.3 Implement a local provider behind that interface; resolve the design.md
      open question on which local runtime, evaluating binary size and quality
- [x] 1.4 Ship with no provider configured, and add the settings surface to choose one
- [x] 1.5 State what content will be transmitted before a remote provider takes effect
- [x] 1.6 Add the persistent interface indication that a remote provider is active
- [x] 1.7 Store credentials in the operating system credential store; never in the
      workspace, the document or any logged output
- [x] 1.8 Write tests: no provider means nothing leaves the machine, provider
      failure leaves the document unchanged, credentials never appear in logs

## 2. Selection commands

- [x] 2.1 Create `src/ai/commands/` with rewrite, summarize, expand, convert to
      table and convert to list
- [x] 2.2 Make every command require a non-empty selection
- [x] 2.3 Parse model output with the core parser and map it with the existing
      mapping; add no second conversion path
- [x] 2.4 Apply accepted results as a single ProseMirror transaction
- [x] 2.5 Handle output that fails schema validation: report failure, leave the
      document unchanged, keep the raw response available
- [x] 2.6 Write tests: result becomes validated structure, single undo reverses an
      accepted result, invalid output does not corrupt the document

## 3. Review before applying

- [x] 3.1 Build the diff view showing additions and removals against the selection
- [x] 3.2 Implement accept and reject
- [x] 3.3 Guarantee that a rejected suggestion leaves the document byte-identical
- [x] 3.4 Resolve the design.md open question on whether results stream into the
      diff view or appear only when complete
- [x] 3.5 Write tests for the reject path and for removals being visible in the diff

## 4. Slash menu integration

- [x] 4.1 Register generative commands through the phase 6 registry
- [x] 4.2 Set availability predicates so they are absent when no provider is configured
- [x] 4.3 Use the existing asynchronous contract for the pending state
- [x] 4.4 Write a test asserting no second menu component was introduced

## 5. Rust: chunking and embeddings

- [x] 5.1 Add the SQLite dependency and the embedding runtime to `src-tauri`
- [x] 5.2 Implement chunking at heading boundaries from the parsed structure,
      splitting oversized sections at block boundaries only
- [x] 5.3 Resolve the design.md open question on the chunk size ceiling by measuring
      against a real documentation workspace
- [x] 5.4 Store file path and heading path with every chunk
- [x] 5.5 Compute embeddings locally, with no network dependency
- [x] 5.6 Handle documents with no headings
- [x] 5.7 Record the resulting binary size and decide whether the model is bundled
      or downloaded on first use

## 6. Rust: background indexing

- [x] 6.1 Run indexing off the user interface thread at low priority
- [x] 6.2 Drive incremental reindexing from the phase 4 watcher, reindexing only
      changed files
- [x] 6.3 Implement pause and resume without restarting from the beginning
- [x] 6.4 Report progress to the frontend during an initial index
- [x] 6.5 Resolve the design.md open question on whether the index lives in the
      workspace or the application data directory
- [x] 6.6 Discard and rebuild a corrupt or outdated index rather than failing
- [x] 6.7 Write tests: editing stays responsive during indexing, only changed files
      are reindexed, deleting the index loses nothing

## 7. Retrieval and panel

- [x] 7.1 Implement retrieval over the index and answer generation
- [x] 7.2 Return citations naming file and section for every answer
- [x] 7.3 Make citations navigable, opening the document at the cited section, and
      handle the case where the section no longer exists
- [x] 7.4 State plainly when nothing relevant was found rather than answering from
      outside the workspace silently
- [x] 7.5 Handle questions asked while the initial index is incomplete
- [x] 7.6 Build the conversational panel, holding its state in the application store
      and never serializing it into a document
- [x] 7.7 Make the panel indicate that a provider is required when none is configured

## 8. Verification

- [x] 8.1 Run `npm run lint` and fix all findings
- [x] 8.2 Run `npm run typecheck` and fix all findings
- [x] 8.3 Run `npm run test` and confirm green
- [x] 8.4 Run `cargo clippy` on `src-tauri` and fix all warnings
- [x] 8.5 Confirm the round-trip suite is still green, since AI results become
      document nodes that must serialize correctly
- [x] 8.6 Verify with network monitoring that no document content leaves the machine
      when no provider is configured
- [x] 8.7 Manually evaluate retrieval quality against a real documentation workspace
      and record the findings

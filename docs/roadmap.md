# Markflow Roadmap

Markflow uses OpenSpec changes to define, implement, validate, and archive product work. Completed changes and their design history are available under [`openspec/changes/archive/`](../openspec/changes/archive/); current capability specifications live under [`openspec/specs/`](../openspec/specs/).

## MVP delivery status

| Phase | OpenSpec change | Status | Depends on |
|---|---|---|---|
| 0 — Foundation | — | Complete | — |
| 1 — Markdown core | `markdown-core-roundtrip` | Complete | — |
| 1.5 — Reader | `markdown-reader` | Complete | phase 1 |
| 2 — Basic editor | `document-editor-base` | Complete | phases 1 and 1.5 |
| 3 — Inline and block formatting | `inline-block-formatting` | Complete | phase 2 |
| 4 — Workspace explorer | `workspace-explorer` | Complete | phases 1.5 and 2 |
| 5 — Tables and images | `tables-and-images` | Complete | phases 3 and 4 |
| 6 — Slash commands | `slash-commands` | Complete | phases 3 and 5 |
| 7 — AI assistance | `ai-assistance` | Complete | phases 4, 5, and 6 |
| MVP usability and validation | `usability-themes-and-mvp-validation` | Complete | phases 1–7 |
| Real-world readiness | `mvp-real-world-readiness` | Complete and archived | MVP validation |

The Windows MVP was packaged, installed, and validated as `v0.1.2`. Automated checks cover linting, type checking, production builds, 721 frontend tests, Rust formatting/Clippy/tests, and Playwright E2E flows.

## MVP scope verification

- **Windows `.md` association:** NSIS registers the file type. Both cold process startup and activation of a running instance canonicalize and validate an existing `.md`, authorize only that file, and open it through the normal loader. Markflow reports—but never rewrites—an overriding Windows `UserChoice`.
- **Fast reading path:** the reproducible measurements are in [`performance-baseline.md`](performance-baseline.md). Reader-only documents do not mount Tiptap, and optional AI initialization happens after first paint.
- **Editor usability:** Dark, Light, and Sepia themes, left-side navigation, visible Read/Raw/Edit controls, a complete Markdown toolbar, keyboard shortcuts, and portable callouts are available without requiring knowledge of hidden commands.
- **Local embeddings:** the approximately 91 MB model is downloaded from AI settings only when requested and is not included in the installer.
- **No-key AI path:** the Beta OpenCode V2 integration discovers models from accounts connected with `/connect` and supported local runtimes. Generation uses an isolated, tool-denied agent and standard input. Markflow does not read OpenCode credentials.
- **Out of scope for the MVP:** cloud sync, collaboration, MCP workspace serving, export pipelines, and multi-window editing.

### AI Beta smoke test

1. Connect a supported account in OpenCode with `/connect`, without purchasing a separate API key when an eligible account or free/local model is available.
2. Open **AI settings → Detect OpenCode** in Markflow.
3. Choose a model, review remote-content consent when applicable, and run **Test connection**. The test uses synthetic text.
4. Run a selection action and verify both accept and reject flows.
5. Ask a question about one open document without embeddings.
6. Download local embeddings and ask a cited question across an indexed workspace.
7. Confirm that rejection, cancellation, and provider errors leave the document unchanged.

Provider classes remain labeled Beta until they pass this flow.

## Foundation delivered outside OpenSpec

The initial project scaffolding was not behavior that needed a product specification:

- Tauri 2, React 19, TypeScript, and Vite 7;
- the core directory structure and dependency stack;
- Tailwind CSS 4, the `@/` alias, Vitest, Playwright, and ESLint;
- Tauri filesystem, dialog, and opener plugins;
- GitHub Actions for frontend and Rust quality gates;
- architecture and performance documentation.

## Completed dependency chain

```text
markdown-core-roundtrip
        │
        ├─► markdown-reader
        │        │
        │        ▼
        └─► document-editor-base
                 │
                 ▼
            inline-block-formatting ──┐
                 │                    │
                 ▼                    │
            workspace-explorer ───────┤
                                      ▼
                              tables-and-images
                                      │
                                      ▼
                                slash-commands
                                      │
                                      ▼
                                 ai-assistance
```

The reader and workspace explorer did not block the main dependency chain: the reader could proceed alongside editor work after the core, and the explorer could proceed alongside inline formatting.

## Post-MVP priorities

The next changes should be proposed and validated independently rather than silently expanding the MVP:

1. **Code signing and trusted distribution.** Sign Windows installers and automate release builds and provenance.
2. **Performance progression.** Virtualize or progressively render very large documents and split large workspace-tree updates into smaller UI tasks.
3. **Embedded account onboarding.** Add OAuth/device-code UI only through supported OpenCode interfaces; keep external `/connect` as the safe fallback.
4. **AI validation expansion.** Add full onboarding E2E coverage and broader local-provider testing.
5. **Accessibility and localization.** Audit keyboard/screen-reader behavior and introduce a maintainable localization system before translating the product UI.
6. **Optional platform expansion.** Package and validate macOS/Linux separately rather than claiming support from cross-platform source alone.
7. **MCP, sync, collaboration, export, and multi-window workflows.** Treat each as a separate product change with explicit trust and persistence boundaries.

The Markdown core should migrate to Rust only if isolated measurements show that normal parsing or serialization exceeds 16 ms, or if indexing blocks the UI. The criterion is documented in [`architecture.md`](architecture.md).

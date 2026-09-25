# Markflow Architecture

This living document describes the architecture that is currently implemented. Historical decisions and their rationale are preserved in the archived OpenSpec changes under [`openspec/changes/archive/`](../openspec/changes/archive/).

## Document pipeline

```text
.md file ──remark parse──> mdast ──mapping──> ProseMirror document
.md file <──remark stringify── mdast <──mapping── ProseMirror document
```

`mdast` is the canonical syntax tree. Reading, editing, Explorer previews, and AI-assisted transformations all pass through it.

## Architectural invariants

1. **Editable document state lives in ProseMirror.** It is never duplicated in React or Zustand. Zustand stores only peripheral state such as workspaces, tabs, appearance, settings, and the AI panel.
2. **`src/core/` has no React or UI dependencies.** The core can be tested in isolation and keeps a future Rust migration bounded.
3. **Round trips are closed.** Opening a file, making no changes, and saving produces no Git diff. Every new schema node must extend the bidirectional mapping and its tests.
4. **There is one rendering pipeline.** The reader and Explorer preview reuse the same core parser.
5. **Typography is shared.** `src/ui/typography.css` is the single source of font families, sizing, heading scale, line height, paragraph spacing, and list indentation for both reader and editor. Mode-specific behavior remains in local stylesheets such as `src/reader/reader.css` and `src/editor/editor.css`.

## Layers

| Directory | Responsibility | Depends on |
|---|---|---|
| `src/core/markdown` | `unified`/`remark` configuration, parsing, and serialization | — |
| `src/core/schema` | ProseMirror schema | `@tiptap/pm` |
| `src/core/mapping` | Bidirectional `mdast ↔ ProseMirror` mapping | schema, markdown |
| `src/reader` | mdast-to-React renderer for Read mode | core |
| `src/editor` | Tiptap extensions, input rules, and slash commands | core |
| `src/explorer` | File tree, quick open, previews, and change monitoring | core, Tauri |
| `src/ai` | Selection commands, providers, document Q&A, and workspace RAG | core |
| `src/ui` | Toolbars, menus, dialogs, and application layout | store |
| `src/store` | Peripheral Zustand state | — |
| `src-tauri/src` | Filesystem access, watcher, indexing, activation, and native commands | — |

## AI and indexing

- Selection commands generate Markdown and pass it back through the core parser and mapping. Users review the proposal before Markflow applies one ProseMirror transaction.
- No provider is active by default. Provider and model preferences are device-wide, so AI can work with a standalone document. Workspace retrieval remains scoped to an opened workspace.
- Remote configuration requires explicit content-sharing consent. Direct-provider credentials live in the operating-system credential store; persisted frontend preferences contain no secrets.
- The local generation provider connects only to a literal loopback IP running a llama.cpp-compatible server. Markflow does not bundle or start the generative runtime or model.
- The optional OpenCode V2 bridge discovers models through the official CLI. Generation runs in an empty temporary workspace with a dedicated `markflow` agent that denies every tool and permission.
- OpenCode prompts are supplied through standard input, never process arguments. Temporary sessions are deleted after generation. OpenCode remains the sole owner of OAuth and API credentials; Markflow does not read its credential database, cookies, passwords, or tokens.
- The webview can request only status/model discovery, a synthetic connection test, generation, and cancellation. It cannot access arbitrary OpenCode API paths, sessions, plugins, commands, the shell, or the filesystem.
- FastEmbed calculates embeddings locally. The pinned all-MiniLM-L6-v2 model (about 91 MB) is downloaded only after an explicit user action.
- SQLite indexes and model metadata live in the application data directory, never in the workspace. A low-priority Rust worker consumes incremental watcher updates.
- Workspace answers cite files and heading paths. Conversation state is peripheral and is never serialized into a Markdown document.
- Legacy credential migration occurs entirely in Rust between operating-system credential identities. The webview never receives the secret.

## Operating-system file activation

The Windows installer registers `.md` as a supported file type. A path received at process startup or from a second instance is canonicalized and validated in Rust as an existing Markdown file. The backend grants the filesystem plugin access to **that exact file only** before notifying the frontend.

Activation events are queued until the frontend listener is ready. A running instance receives focus and opens the file through the normal reader-mode loader. Access to sibling images is granted separately by `allow_document_directory`; the frontend cannot authorize an arbitrary initial path.

Markflow reads Windows `UserChoice` only to explain when another default application overrides installer registration. It never rewrites the protected value.

## Startup

The backend and webview publish local monotonic timing markers for process start, backend readiness, React dispatch, first paint, file authorization, parsing, and visible document content.

Markers are written to JSONL only when a validation process defines `MARKFLOW_STARTUP_METRICS_FILE`. They are never transmitted. AI restoration runs after the initial render, and Tiptap is not mounted for reader-only documents. After a document enters Edit mode, its editor stays mounted to preserve caret position and undo history.

## Presentation and editing

Dark is the default theme; Light and Sepia are stored as local preferences. The top bar groups file opening, document modes, AI, and appearance behind accessible controls. Document navigation is on the left and can collapse from its edge.

The editor toolbar exposes the Markdown schema, including H1–H6, lists, code, and tables, while ProseMirror remains the only owner of editable document state. Portable callouts use Markdown syntax such as `> [!WARNING]` rather than colored HTML and preserve that syntax during serialization.

The original local AI evaluation and measurements are recorded in [`openspec/changes/archive/2026-09-24-ai-assistance/evaluation.md`](../openspec/changes/archive/2026-09-24-ai-assistance/evaluation.md).

## Serializer normal form

The project-wide normal form is defined in `src/core/markdown/options.ts`:

- `-` bullet markers;
- `*` emphasis and `**` strong emphasis;
- backtick code fences;
- `-` thematic breaks;
- `one` list indentation;
- incrementing ordered-list markers.

Callers cannot supply different options: `serializeMarkdown` accepts no options parameter. Changing any normal-form value invalidates the fixture corpus.

Remark's final-newline behavior is preserved and verified against the corpus. A non-empty document ends with exactly one `\n`; an empty document serializes to an empty string. This follows the POSIX convention and produces clean Git diffs without custom normalization.

## Preservation nodes

An mdast node without a registered handler travels through ProseMirror as an opaque preservation node carrying the original subtree. Opening and saving must not destroy unsupported content.

There are two preservation types: `preserved` and `preservedInline`. ProseMirror's block/inline distinction belongs to the node type, so an unsupported block such as a table and an unsupported inline fragment cannot share one type. Both otherwise behave identically and restore their original mdast subtree during reverse mapping.

## Mapping registry lessons

The `inline-block-formatting` phase was the first large test of the handler-pair registry. It added five marks (`strong`, `emphasis`, `strikethrough`, `inlineCode`, and `link`) and five block types (`list`, `listItem`, `blockquote`, `codeBlock`, and `thematicBreak`) without changing the registry core.

That work exposed two useful constraints:

1. **The registry maps mdast and ProseMirror types one to one.** mdast represents ordered and unordered lists with one `list` type plus an `ordered` property. Markflow therefore models one ProseMirror `list` node with the same property. A future true many-to-one relationship would require extending the registry.
2. **ProseMirror marks are not nodes.** The mdast-to-ProseMirror direction can add a mark while converting a node. The reverse direction must reconstruct nesting from sibling ranges. Text-block handlers therefore use `handlers/phrasing.ts`, which resolves each registered mark through an injected registry lookup.

Marks covering exactly the same range have no inherent nesting order in ProseMirror. Markflow uses schema order—link, emphasis, strong, strikethrough, inline code—to match remark for common forms such as `***x***` and `[**x**](url)`. Consequently, `**[x](url)**` serializes as `[**x**](url)`: rendering is equivalent, but the tree differs. This is the only known structural normalization in the mapping and is covered by the documented normal form.

## Rust migration criterion

The Markdown core remains in TypeScript. It should move to Rust **only after measurement** shows that parsing or serialization of a typical document exceeds 16 ms (one frame at 60 fps), or that workspace indexing blocks the UI thread. Measure before migrating. The current measurements and limitations are documented in [`performance-baseline.md`](performance-baseline.md).

# Changelog

All notable changes to Markflow are documented in this file.

## [0.1.2] - 2026-09-25

First public Beta release.

### Added

- Native Windows Markdown editor with Read, Raw, and visual Edit modes.
- Formatting for headings, inline styles, links, lists, task lists, quotes, code blocks, tables, images, and thematic breaks.
- Workspace file tree, previews, tabs, quick open, outline navigation, and external-change handling.
- Dark, Light, and Sepia themes.
- Windows `.md` file association with cold-launch and running-instance activation.
- Optional AI assistance for the open document and local-embedding workspace retrieval.
- OpenCode V2 model discovery, account reuse, generation, timeout, and cancellation without accessing OpenCode credentials.
- Direct remote and local llama.cpp provider options.

### Security and reliability

- Exact-file authorization for Markdown documents opened by the operating system.
- Atomic saves and byte-preserving no-edit behavior.
- Explicit consent before sending content to remote AI models.
- OpenCode prompts sent through standard input in an isolated, tool-denied workspace.
- Provider secrets kept in the operating-system credential store.

### Performance

- Reader-first startup avoids mounting the editor until editing is requested.
- AI discovery and workspace indexing are deferred until after first paint.
- Validated warm startup is typically below one second on the reference Windows machine.

### Known limitations

- Windows is the only packaged and validated platform for this release.
- AI features are Beta.
- OpenCode account connection currently uses the supported external `/connect` flow.
- Installers are not code-signed and may trigger Windows SmartScreen.

[0.1.2]: https://github.com/NahuelAparicio10/MarkflowNG/releases/tag/v0.1.2

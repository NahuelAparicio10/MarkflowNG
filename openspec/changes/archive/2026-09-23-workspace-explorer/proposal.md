## Why

Up to this point the product opens one file at a time through a dialog. The real
use case from `Context/EXPLORE.md` is a folder of documentation living beside code:
GDDs, system specs, balance tables, design notes. Working in that folder means
moving between files constantly, and a file dialog is the wrong instrument for it.

This change introduces the workspace: a folder the application is opened against,
a navigable tree, fuzzy quick open, instant previews, and awareness of changes made
on disk by other tools such as git or an IDE. Corresponds to **Fase 4** of
`Context/EXPLORE.md`.

## What Changes

- Add the concept of a workspace: a root folder the user opens, scanned in Rust.
- Add a virtualized directory tree that stays responsive at thousands of files.
- Add fuzzy quick open over workspace files, invoked by shortcut.
- Add fast previews that render a document without mounting the editing engine,
  reusing the reader.
- Add a filesystem watcher in Rust reporting external creations, modifications,
  renames and deletions.
- Add external-change handling for the open document, distinguishing the safe case
  from the conflict case.
- Add tabs so several documents can be open at once.

## Capabilities

### New Capabilities
- `workspace`: opening a folder as the working root, scanning it, keeping the file
  listing current, and reacting to changes made outside the application.
- `file-navigation`: the directory tree, fuzzy quick open, document previews, and
  tabs for multiple open documents.

## Impact

- New code: `src/explorer/`, workspace and tabs slices in `src/store/`, scanning
  and watching commands in `src-tauri/src/`.
- Uses the `watch` feature of `tauri-plugin-fs`, already enabled in `Cargo.toml`.
- First change where meaningful work happens in Rust. Per the `EXPLORE.md`
  decision, filesystem work belongs there because it does not cross the IPC bridge
  in the hot editing path.
- External change detection interacts with autosave from `document-editor-base`:
  the application must not treat its own writes as external modifications.
- Tabs change the session model from one open document to several, which affects
  every consumer written under the single-document assumption.

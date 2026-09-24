## Why

Markflow currently makes basic workflows hard to discover: documents open read-only without a visible Edit action, workspace-only AI controls appear disabled for a directly opened file, the interface has little visual hierarchy, and the outline is not initially available. This change closes those usability gaps, adds selectable themes, and verifies the remaining MVP promises for opening `.md` files and handling large documents/workspaces (EXPLORE phases 1.5, 2, 4, and 7).

## What Changes

- Establish a polished, restrained editor visual system with dark mode as the default and user-selectable light and sepia themes; add consistent hover, focus, disabled, and active states.
- Make editing discoverable with a visible Edit/Read control, and make the left-side document outline open by default with a control below the main toolbar to collapse/reopen it.
- Make AI settings available without first opening a workspace. Provider/model preferences become device-wide; selection commands work for a standalone document, while workspace Q&A clearly requests a workspace when one is not open.
- Configure Windows `.md` file association and route files opened by the OS into Markflow's reader mode.
- Add repeatable performance checks for opening/rendering representative large Markdown files and scanning/navigating large workspaces; document measured results and any remaining bottlenecks.

## Capabilities

### New Capabilities
- `appearance-themes`: coherent interactive styling, dark default, and selectable themes.
- `markdown-file-association`: register and open Markdown files from the operating system.

### Modified Capabilities
- `document-reader`: default outline visibility, left-side collapsible placement, and discoverable mode switching.
- `ai-provider`: device-wide provider configuration and selection AI for standalone documents.
- `ai-document-commands`: allow selection commands on standalone documents.
- `ai-retrieval`: explain and gate workspace questions when no workspace is open.
- `file-navigation`: measurable responsiveness expectations for large documents/workspaces.

## Impact

Touches React layout and styles, theme/settings persistence, document session controls, AI provider scope and availability, Tauri Windows bundle configuration and startup-file handling, plus performance fixtures/scripts and documentation. No Markdown document format or core AST behavior changes.

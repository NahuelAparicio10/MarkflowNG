## Why

By this point every block type in the MVP is editable, but inserting one requires
either knowing its Markdown input rule or finding it in a toolbar. Input rules only
help for elements with memorable syntax; there is no syntax to type for a table,
and no discoverable path to one for a user who does not already know the product.

The slash menu is the standard answer, and `Context/EXPLORE.md` specifies it. It is
also deliberately built before the AI layer, because phase 7 adds generative
actions to this same menu, and building the menu first means the AI work adds
entries rather than inventing a surface. Corresponds to **Fase 6** of
`Context/EXPLORE.md`.

## What Changes

- Add a slash menu triggered by typing `/` at the start of an empty block.
- Add filtering as the user continues typing, with keyboard navigation and selection.
- Add entries for every insertable block: headings, lists, task lists, quote, code
  block, table, image, horizontal rule.
- Add a command registry so entries are declared in one place, with the extension
  point phase 7 uses to contribute generative actions.
- Ensure the menu dismisses cleanly and leaves the document in the state the user
  expects when abandoned.

## Capabilities

### New Capabilities
- `command-menu`: the slash-triggered insertion menu, its registry, its filtering
  and keyboard interaction, and the extension point for contributed commands.

## Impact

- New code: `src/editor/slashMenu/`, command registry, menu UI in `src/ui/`.
- Depends on `inline-block-formatting` and `tables-and-images` for the block types
  it inserts.
- The registry shape is a contract with `ai-assistance`, which contributes entries
  to it. Getting that extension point right here avoids reshaping the menu later.
- Interacts with input rules: typing `/` must not conflict with existing rules, and
  abandoning the menu must leave the literal text the user typed.

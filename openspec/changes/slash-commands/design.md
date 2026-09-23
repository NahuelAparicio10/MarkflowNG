## Context

All MVP block types are editable. What is missing is a way to reach them that does
not depend on knowing Markdown syntax, which is precisely the knowledge this
product exists to make unnecessary.

The menu is small in itself. Its importance is that it is the extension point the
AI layer plugs into, so the registry shape decided here constrains phase 7.

## Goals / Non-Goals

**Goals:**
- A menu triggered by `/` that filters as the user types.
- Full keyboard operation.
- One declaration point for commands.
- An extension mechanism that supports asynchronous commands, which generative
  actions will need.
- Clean abandonment that never surprises the user.

**Non-Goals:**
- Generative commands themselves. Phase 7.
- A general command palette for application-level actions such as opening files.
  That is quick open's territory and a different interaction.
- User-defined custom commands.

## Decisions

### D1. The trigger is `/` at the start of an empty block only

The menu opens when `/` is typed in an empty block, not anywhere in the text.

*Alternatives considered:* triggering after any whitespace, as some editors do.
Rejected because documentation about file paths, command lines and URLs contains
slashes constantly, and this product's own use case is technical writing. The
restrictive trigger has near-zero false positives; the permissive one would fire
while writing `src/core/` in a sentence.

### D2. Commands are declared in a registry, not enumerated in the menu component

Each command declares its identifier, label, keywords, group, an availability
predicate and its action. The menu renders whatever the registry holds.

*Alternatives considered:* a hardcoded list inside the menu component. Rejected
because phase 7 must contribute entries from `src/ai/`, and because the
availability predicate is needed regardless: "insert row" is meaningless outside a
table, and a generative command is unavailable when no provider is configured.

### D3. Command actions are asynchronous by contract, even though none is yet

The action signature returns a promise from the outset, and the menu supports a
pending state.

*Alternatives considered:* a synchronous signature, widened in phase 7. Rejected
because widening it later changes every existing command's type and the menu's
rendering logic. Declaring it now costs nothing: a synchronous insertion simply
resolves immediately. This is the same reasoning that made the reader declare the
`editor` mode before it existed.

### D4. Abandoning the menu leaves the literal typed text

Pressing Escape, or typing something that matches nothing, closes the menu and
leaves `/` and whatever followed it in the document as plain text.

*Alternatives considered:* removing the typed text on dismissal. Rejected because
the user may genuinely have wanted to write a slash, and deleting characters they
typed is the more surprising outcome. This also matches the input-rule principle
from phase 3, that the literal typed text is always recoverable.

### D5. Filtering matches labels and keywords, not labels alone

Each command carries keywords, so "bullet" finds the unordered list and "code"
finds the code block.

*Alternatives considered:* matching the label only. Rejected because it forces the
user to guess the exact name chosen, which is the discoverability problem the menu
was built to solve.

### D6. Insertion replaces the trigger text as one transaction

Selecting a command removes the `/` and the typed filter and inserts the block in a
single transaction, so one undo returns to the literal typed text.

*Alternatives considered:* two transactions, one to clear and one to insert.
Rejected for the same reason as the input-rule decision in phase 3: it produces an
intermediate state the user never created and makes undo behave unexpectedly.

## Risks / Trade-offs

- **The registry shape does not fit what generative commands need, and phase 7 has
  to reshape it** → Mitigated by D3, which anticipates the asynchronous case, and
  by the availability predicate, which anticipates conditional entries. Remaining
  risk: streaming results, which is a rendering concern for the AI panel rather
  than a menu concern.
- **The trigger is too restrictive and users cannot find the menu from mid-paragraph**
  → Real trade-off accepted in D1. Mitigated by keeping the toolbar and input rules
  as alternative paths, and by revisiting if it proves limiting in practice.
- **Menu positioning breaks near the viewport edge or in a scrolled document** →
  Ordinary popup positioning work; the menu flips when it would overflow.
- **Keyboard handling conflicts with editor bindings, particularly the arrow keys
  and Enter while the menu is open** → The menu takes priority while open, and
  releases every binding on close. Covered by tests.

## Migration Plan

Purely additive. No existing behavior changes and nothing on disk is affected.

## Open Questions

- ~~Should the menu group commands into sections such as basic blocks and media?~~
  **Resolved: yes.** Every command already declares a `group`, so sections cost
  nothing extra. The menu lists sections in the order each group was first
  registered — *Text*, *Lists*, *Insert* for the built-in entries — and draws a
  section header only when more than one section is visible, so a narrow filter
  shows a plain list. Phase 7 adds its section by registering commands under a
  new group, with no change to the menu.
- Should recently used commands be surfaced first? Deferred; needs a small amount
  of persisted state that does not exist yet.

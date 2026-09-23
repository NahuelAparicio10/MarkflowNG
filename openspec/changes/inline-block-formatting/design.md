## Context

The schema, the mapping registry and the round-trip harness all exist. This change
is the first real test of whether the registry design from `markdown-core` holds:
roughly a dozen new node and mark types arrive at once, and if adding them
requires touching the mapping core, decision D2 of that change was wrong.

The other theme here is that this is the first change where *feel* matters. Input
rules and shortcuts are the difference between an editor that works and one that
is pleasant, and they interact with undo in ways that are easy to get subtly wrong.

## Goals / Non-Goals

**Goals:**
- Marks and block structure, editable and round-tripping.
- Handler pairs registered from their own modules, with no edit to the mapping core.
- Input rules that make writing feel like Markdown without ever showing Markdown.
- Shortcuts matching platform conventions.
- Fixture and parity coverage for every element added.

**Non-Goals:**
- Tables and images. Phase 5, because they tension the mapping hardest.
- The slash command menu. Phase 6, though input rules cover much of the same ground.
- Syntax highlighting inside code blocks. Additive, and orthogonal to round-tripping.
- Nested list edge cases beyond what remark itself round-trips.

## Decisions

### D1. Marks and nodes are added as independent handler pairs, one module each

Each element is a module under `src/core/mapping/handlers/` registering its forward
and backward handler, plus its schema contribution.

*Alternatives considered:* adding all marks in one module and all blocks in
another. Rejected because it makes the change atomic when it does not need to be:
per-element modules mean emphasis can land, be tested and be reviewed while lists
are still in progress, and a regression points at one file.

### D2. Input rules must produce a single undo step

Each input rule is applied as one transaction, so undo after an automatic
conversion returns to the literal text the user typed rather than unwinding
character by character.

*Alternatives considered:* letting the conversion be a separate transaction from
the typing that triggered it. Rejected because pressing undo would then leave the
user in the converted state with the trigger text removed, which is a state they
never typed. The convention users expect, established by every editor with this
feature, is that undo once yields the literal syntax and undo again removes it.

### D3. Input rules are opt-out per document, not per keystroke

There is a single setting to disable automatic conversion, rather than an
in-context dismissal affordance for each conversion.

*Alternatives considered:* a transient "undo this conversion" affordance after each
rule fires, as some editors offer. Rejected as disproportionate for this phase:
D2 already makes undo the escape hatch, and the affordance adds UI surface and
timing state for a rare case. Revisit if it proves annoying in practice.

### D4. Links require an explicit affordance, not only an input rule

A link is created through a small input surface invoked by shortcut or by pasting a
URL over a selection.

*Alternatives considered:* relying solely on typing `[text](url)` and letting the
input rule convert it. Rejected because it requires the user to type Markdown
syntax, which the product exists to avoid, and because editing an existing link's
target would then have no path at all.

### D5. Pasting a URL over a selection creates a link

*Alternatives considered:* pasting the URL as text, the default behavior.
Rejected because linking a selection is the single most common link operation and
the alternative costs the user four extra interactions.

### D6. Code blocks store the language as an attribute, not as a class

The `codeBlock` node carries `language` as a schema attribute, mapping directly to
the mdast `code` node's `lang` field.

*Alternatives considered:* storing it as a CSS class on the rendered element, the
approach several editors take for highlighting compatibility. Rejected because the
attribute is what the mapping needs, and deriving it back out of a class string is
a parsing step that can fail. Highlighting can read the attribute when it is added.

### D7. Task lists are list items with a checked attribute, not a separate list type

Matching mdast, where a task item is a `listItem` with `checked` set to a boolean
rather than a distinct node type.

*Alternatives considered:* a distinct `taskList` node type. Rejected because it
would not match mdast, so the mapping would have to decide which list type to emit
based on content inspection, and a list mixing checked and unchecked items with
plain ones would have no correct answer.

### D8. Unsupported-content preservation stays in place

The preservation path from `markdown-core` remains for tables, images and
frontmatter.

*Alternatives considered:* removing it now that most content is handled. Rejected
firmly: it is the guarantee that a document with a table can be edited safely
before phase 5, and it remains the safety net for any Markdown extension the
schema will never cover.

### D9. Bulleted and ordered lists are one `list` node type with an `ordered` attribute

Resolved during implementation. mdast has a single `list` node carrying
`ordered`, `start` and `spread`, and the ProseMirror schema mirrors it.

*Alternatives considered:* separate `bulletList` and `orderedList` node types, as
tasks 2.1 originally named them. Rejected because the mapping registry is
one-to-one between an mdast type and a ProseMirror type: two ProseMirror types
mapping back to one mdast `list` would have required changing the registry, which
is the mapping core this change must leave untouched. The single type is also the
same reasoning as D7 — matching mdast avoids a mapping decision — and makes
switching a list between bulleted and numbered an attribute change rather than a
node replacement.

### D10. Marks map through the same handler pairs, regrouped by textblock handlers

A mark is registered as an ordinary handler pair keyed by its mdast type and its
mark name. The forward direction needs nothing new: an mdast `strong` handler
converts its children and adds the mark to each. The backward direction cannot
be per node, because nesting has to be rebuilt from a run of siblings, so the
paragraph and heading handlers convert their inline content through a shared
helper in `handlers/phrasing.ts`, which calls each mark's registered handler. The
composition entry point hands that helper a lookup into the registry.

Marks covering exactly the same span carry no nesting order in ProseMirror; they
are nested in schema rank order (link, emphasis, strong, strikethrough, inline
code), chosen to match the forms remark produces for `***x***` and
`[**x**](url)`. `**[x](url)**` therefore comes back as `[**x**](url)` —
equivalent rendering, different tree.

## Risks / Trade-offs

- **The registry design does not actually scale and adding twelve types requires
  reworking the mapping core** → This change is the test. If it happens, it is
  better discovered here, with twelve types, than in phase 5 with tables. The
  mitigation is that per-element modules make the rework incremental.
- **Input rules fire when the user wanted literal text, for example typing about
  Markdown syntax** → Mitigated by D2, which makes a single undo the escape, and
  by D3's global setting for users who never want it.
- **Nested and mixed lists round-trip incorrectly, since list serialization has
  many valid forms** → Highest-risk element in the change. Mitigated by pinning
  the list-related stringify options in `markdown-core` and by fixtures covering
  nesting, mixed ordered and unordered, loose and tight lists, and task items
  inside nested lists.
- **Shortcut collisions with the operating system or the webview** → Verified on
  Windows during implementation; the shortcut table lives in one module so
  conflicts are resolved in one place.
- **The change is large enough to stall** → Mitigated by D1: each element is
  independently landable, and the task list is ordered so marks ship before blocks.

## Migration Plan

Documents previously containing preserved inert blocks for these element types will
open with that content editable instead. No stored data changes, since the
preservation attribute is derived at load time, not persisted. Files on disk are
unaffected until the user edits and saves.

## Open Questions

- ~~Should `Ctrl+K` open the link affordance?~~ Resolved: yes, `Mod-k`. Nothing
  else in the app binds it, and in Chromium/WebView2 a page may override it.
- ~~Should an empty list item on Enter exit the list?~~ Resolved: yes, one level
  at a time. An empty top-level item becomes a paragraph after the list; an empty
  nested item moves out to its parent list.

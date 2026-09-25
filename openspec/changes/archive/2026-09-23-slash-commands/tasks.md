## 1. Command registry

- [x] 1.1 Create `src/editor/slashMenu/types.ts` defining the command contract:
      identifier, label, keywords, group, availability predicate, asynchronous action
- [x] 1.2 Create `src/editor/slashMenu/registry.ts` with registration and lookup
- [x] 1.3 Write a test asserting a command registered from an unrelated module
      appears in the menu without modifying the menu component
- [x] 1.4 Write a test asserting commands whose availability predicate is false are
      excluded

## 2. Trigger

- [x] 2.1 Implement the trigger: forward slash at the start of an empty block only
- [x] 2.2 Suppress the trigger inside code blocks
- [x] 2.3 Confirm no conflict with existing input rules from phase 3
- [x] 2.4 Write tests: opens in an empty block, does not open mid-sentence, does not
      open in a code block

## 3. Menu UI and interaction

- [x] 3.1 Create the menu component rendering registry entries, positioned at the
      caret and flipping when it would overflow the viewport
- [x] 3.2 Implement filtering against labels and keywords
- [x] 3.3 Implement arrow-key selection and Enter activation, taking priority over
      editor bindings while open
- [x] 3.4 Release all bindings on close
- [x] 3.5 Support a pending state for asynchronous commands, even though none is
      asynchronous yet
- [x] 3.6 Resolve the design.md open question on grouping entries into sections

## 4. Insertion commands

- [x] 4.1 Register commands for headings of each level
- [x] 4.2 Register commands for bulleted list, numbered list and task list
- [x] 4.3 Register commands for blockquote, code block and horizontal rule
- [x] 4.4 Register commands for table and image
- [x] 4.5 Give every command keywords covering the terms a user would plausibly type
- [x] 4.6 Write a test asserting every insertable block type is reachable from an
      unfiltered menu

## 5. Abandonment and undo

- [x] 5.1 Implement Escape dismissal leaving the literal typed text
- [x] 5.2 Implement no-match dismissal leaving the literal typed text
- [x] 5.3 Implement command execution as a single transaction replacing the trigger
      text and inserting the block
- [x] 5.4 Write tests for both dismissal paths and for single-undo behavior

## 6. Verification

- [x] 6.1 Run `npm run lint` and fix all findings
- [x] 6.2 Run `npm run typecheck` and fix all findings
- [x] 6.3 Run `npm run test` and confirm green
- [x] 6.4 Add a Playwright e2e test: trigger the menu, filter by keyword, insert a
      table, undo once and confirm the literal text returns
- [x] 6.5 Confirm the round-trip suite is still green, since insertion commands
      create nodes that must serialize correctly

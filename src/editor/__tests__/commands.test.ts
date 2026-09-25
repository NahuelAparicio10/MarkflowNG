import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { enterInList, indentListItem, outdentListItem, toggleMarkCommand } from "../commands";
import { toggleTaskItemAt } from "../editingBehavior";
import { createTestView, docFrom, markdownOf, positionAfter, typeText, type TestView } from "./harness";

function select(view: TestView, from: number, to: number) {
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

function caretAfter(view: TestView, text: string) {
	const pos = positionAfter(view.state.doc, text);
	select(view, pos, pos);
}

describe("mark toggling", () => {
	it("applies a mark to the selection without showing any syntax", () => {
		const view = createTestView(docFrom("one two three\n"));
		const end = positionAfter(view.state.doc, "two");
		select(view, end - 3, end);

		toggleMarkCommand("strong")(view.state, view.dispatch);

		expect(view.state.doc.textContent).toBe("one two three");
		expect(markdownOf(view)).toBe("one **two** three\n");
	});

	it("removes the mark when the whole selection already carries it", () => {
		const view = createTestView(docFrom("one **two** three\n"));
		const end = positionAfter(view.state.doc, "two");
		select(view, end - 3, end);

		toggleMarkCommand("strong")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("one two three\n");
	});

	it("adds the mark to all of a selection that only partly carries it", () => {
		const view = createTestView(docFrom("**one** two\n"));
		select(view, 1, view.state.doc.child(0).content.size + 1);

		toggleMarkCommand("strong")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("**one two**\n");
	});

	it("marks text typed next when the selection is empty", () => {
		const view = createTestView(docFrom("start\n"));
		caretAfter(view, "start");

		toggleMarkCommand("emphasis")(view.state, view.dispatch);
		typeText(view, " more");

		expect(markdownOf(view)).toBe("start *more*\n");
	});

	it("does nothing inside a code block, which admits no marks", () => {
		const view = createTestView(docFrom("```\ncode\n```\n"));
		select(view, 1, 5);

		expect(toggleMarkCommand("strong")(view.state, view.dispatch)).toBe(false);
	});
});

describe("Enter in lists", () => {
	it("continues the list from a non-empty item", () => {
		const view = createTestView(docFrom("- one\n"));
		caretAfter(view, "one");

		expect(enterInList(view.state, view.dispatch)).toBe(true);
		typeText(view, "two");

		expect(markdownOf(view)).toBe("- one\n- two\n");
	});

	it("leaves the list from an empty top-level item", () => {
		const view = createTestView(docFrom("- one\n"));
		caretAfter(view, "one");
		enterInList(view.state, view.dispatch);

		expect(enterInList(view.state, view.dispatch)).toBe(true);
		typeText(view, "after");

		expect(view.state.doc.child(1).type.name).toBe("paragraph");
		expect(markdownOf(view)).toBe("- one\n\nafter\n");
	});

	it("moves an empty nested item out one level", () => {
		const view = createTestView(docFrom("- one\n  - nested\n"));
		caretAfter(view, "nested");
		enterInList(view.state, view.dispatch);

		expect(enterInList(view.state, view.dispatch)).toBe(true);
		typeText(view, "two");

		expect(markdownOf(view)).toBe("- one\n  - nested\n- two\n");
	});

	it("continues a task list with an unchecked task item", () => {
		const view = createTestView(docFrom("- [x] done\n"));
		caretAfter(view, "done");
		enterInList(view.state, view.dispatch);
		typeText(view, "next");

		expect(markdownOf(view)).toBe("- [x] done\n- [ ] next\n");
	});

	it("declines outside a list, leaving Enter to the default split", () => {
		const view = createTestView(docFrom("para\n"));
		caretAfter(view, "para");

		expect(enterInList(view.state, view.dispatch)).toBe(false);
	});

	it("declines inside a code block in a list item, so Enter is a newline", () => {
		const view = createTestView(docFrom("- ```\n  code\n  ```\n"));
		caretAfter(view, "code");

		expect(enterInList(view.state, view.dispatch)).toBe(false);
	});
});

describe("indent and outdent", () => {
	it("nests an item under the previous one, and the nesting round-trips", () => {
		const view = createTestView(docFrom("- one\n- two\n"));
		caretAfter(view, "two");

		expect(indentListItem(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("- one\n  - two\n");
	});

	it("moves a nested item back out", () => {
		const view = createTestView(docFrom("- one\n  - two\n"));
		caretAfter(view, "two");

		expect(outdentListItem(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("- one\n- two\n");
	});

	it("keeps Tab in the editor on a first item that cannot be nested", () => {
		const view = createTestView(docFrom("- one\n"));
		caretAfter(view, "one");

		expect(indentListItem(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("- one\n");
	});

	it("declines outside a list", () => {
		const view = createTestView(docFrom("para\n"));
		caretAfter(view, "para");

		expect(indentListItem(view.state, view.dispatch)).toBe(false);
		expect(outdentListItem(view.state, view.dispatch)).toBe(false);
	});
});

describe("task checkboxes", () => {
	it("toggles a task item and round-trips to the checked form", () => {
		const view = createTestView(docFrom("- [ ] todo\n"));

		expect(toggleTaskItemAt(positionAfter(view.state.doc, "todo"))(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("- [x] todo\n");
	});

	it("leaves a plain item alone", () => {
		const view = createTestView(docFrom("- plain\n"));

		expect(toggleTaskItemAt(positionAfter(view.state.doc, "plain"))(view.state, view.dispatch)).toBe(false);
	});

	it("keeps each item's own form in a mixed list", () => {
		const view = createTestView(docFrom("- [ ] todo\n- plain\n"));
		toggleTaskItemAt(positionAfter(view.state.doc, "todo"))(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("- [x] todo\n- plain\n");
	});
});

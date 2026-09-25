import { TextSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { getActiveLink, isUrl, linkSelectionWithUrl, removeLink, setLink } from "../links";
import { createTestView, docFrom, markdownOf, positionAfter, typeText, type TestView } from "./harness";

function selectText(view: TestView, text: string) {
	const end = positionAfter(view.state.doc, text);
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end - text.length, end)));
}

function caretInside(view: TestView, text: string) {
	const pos = positionAfter(view.state.doc, text) - 1;
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

describe("creating a link", () => {
	it("links the selected text to the target, showing only the text", () => {
		const view = createTestView(docFrom("see the docs here\n"));
		selectText(view, "the docs");

		expect(setLink("https://example.com")(view.state, view.dispatch)).toBe(true);

		expect(view.state.doc.textContent).toBe("see the docs here");
		expect(markdownOf(view)).toBe("see [the docs](https://example.com) here\n");
	});

	it("inserts the URL as linked text when nothing is selected", () => {
		const view = createTestView(docFrom("see\n"));
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, positionAfter(view.state.doc, "see"))));
		typeText(view, " ");

		setLink("https://example.com")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("see <https://example.com>\n");
	});
});

describe("editing a link target", () => {
	it("reports the current target of the link the caret is in", () => {
		const view = createTestView(docFrom('[docs](https://old.example "Docs")\n'));
		caretInside(view, "docs");

		expect(getActiveLink(view.state)).toMatchObject({ href: "https://old.example", title: "Docs" });
	});

	it("retargets the whole link, keeping its text and title", () => {
		const view = createTestView(docFrom('a [the docs](https://old.example "Docs") b\n'));
		caretInside(view, "the");

		setLink("https://new.example")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe('a [the docs](https://new.example "Docs") b\n');
	});

	it("finds no link when the caret is outside one", () => {
		const view = createTestView(docFrom("plain [link](https://example.com)\n"));
		caretInside(view, "plain");

		expect(getActiveLink(view.state)).toBeNull();
	});
});

describe("pasting a URL over a selection", () => {
	it("links the selected text instead of replacing it", () => {
		const view = createTestView(docFrom("read this now\n"));
		selectText(view, "this");

		expect(linkSelectionWithUrl("https://example.com/page")(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("read [this](https://example.com/page) now\n");
	});

	it("lets a paste of ordinary text proceed normally", () => {
		const view = createTestView(docFrom("read this now\n"));
		selectText(view, "this");

		expect(linkSelectionWithUrl("some words")(view.state, view.dispatch)).toBe(false);
	});

	it("lets a URL paste with no selection proceed normally", () => {
		const view = createTestView(docFrom("read\n"));

		expect(linkSelectionWithUrl("https://example.com")(view.state, view.dispatch)).toBe(false);
	});

	it("recognises a single URL, not prose containing one", () => {
		expect(isUrl("https://example.com/a?b=c")).toBe(true);
		expect(isUrl("  mailto:someone@example.com ")).toBe(true);
		expect(isUrl("see https://example.com")).toBe(false);
		expect(isUrl("example.com")).toBe(false);
	});
});

describe("removing a link", () => {
	it("removes the link around the caret and keeps its text", () => {
		const view = createTestView(docFrom("a [linked text](https://example.com) b\n"));
		caretInside(view, "linked");

		expect(removeLink(view.state, view.dispatch)).toBe(true);
		expect(markdownOf(view)).toBe("a linked text b\n");
	});

	it("treats an empty target as removal", () => {
		const view = createTestView(docFrom("[x](https://example.com)\n"));
		caretInside(view, "x");

		setLink("  ")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("x\n");
	});

	it("declines when there is no link to remove", () => {
		const view = createTestView(docFrom("plain\n"));

		expect(removeLink(view.state, view.dispatch)).toBe(false);
	});
});

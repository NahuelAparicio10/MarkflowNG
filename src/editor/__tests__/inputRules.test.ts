import { undo } from "@tiptap/pm/history";
import { describe, expect, it } from "vitest";
import { schema } from "../../core/schema";
import { INPUT_RULES, createInputRulesPlugin } from "../inputRules";
import { createTestView, emptyDoc, markdownOf, pressKey, typeText, type TestView } from "./harness";

function setup(enabled = true) {
	const plugin = createInputRulesPlugin(INPUT_RULES, () => enabled);
	const view = createTestView(emptyDoc(), [plugin], 1);

	return { plugin, view, type: (text: string) => typeText(view, text, plugin) };
}

function firstBlock(view: TestView) {
	return view.state.doc.child(0);
}

function undoOnce(view: TestView) {
	return undo(view.state, view.dispatch);
}

describe("block input rules", () => {
	it("turns '# ' into a heading of level one, with no hash visible", () => {
		const { view, type } = setup();
		type("# Title");

		expect(firstBlock(view).type.name).toBe("heading");
		expect(firstBlock(view).attrs.level).toBe(1);
		expect(firstBlock(view).textContent).toBe("Title");
	});

	it("maps the number of hashes to the heading level", () => {
		const { view, type } = setup();
		type("### x");

		expect(firstBlock(view).attrs.level).toBe(3);
	});

	it("turns '- ' into a bulleted list item", () => {
		const { view, type } = setup();
		type("- item");

		expect(firstBlock(view).type.name).toBe("list");
		expect(firstBlock(view).attrs.ordered).toBe(false);
		expect(markdownOf(view)).toBe("- item\n");
	});

	it("turns '3. ' into a numbered list starting at three", () => {
		const { view, type } = setup();
		type("3. item");

		expect(firstBlock(view).attrs).toMatchObject({ ordered: true, start: 3 });
		expect(markdownOf(view)).toBe("3. item\n");
	});

	it("turns '- [ ] ' into an unchecked task item", () => {
		const { view, type } = setup();
		type("- [ ] todo");

		const item = firstBlock(view).child(0);
		expect(item.attrs.checked).toBe(false);
		expect(item.textContent).toBe("todo");
		expect(markdownOf(view)).toBe("- [ ] todo\n");
	});

	it("turns '[x] ' in a plain paragraph into a checked task item", () => {
		const { view, type } = setup();
		type("[x] done");

		expect(firstBlock(view).child(0).attrs.checked).toBe(true);
		expect(markdownOf(view)).toBe("- [x] done\n");
	});

	it("turns '> ' into a blockquote, with no marker visible", () => {
		const { view, type } = setup();
		type("> quoted");

		expect(firstBlock(view).type.name).toBe("blockquote");
		expect(firstBlock(view).textContent).toBe("quoted");
	});

	it("turns a code fence followed by a space into a code block with that language", () => {
		const { view, type } = setup();
		type("```ts ");

		expect(firstBlock(view).type.name).toBe("codeBlock");
		expect(firstBlock(view).attrs.language).toBe("ts");
	});

	it("turns a code fence followed by Enter into a code block", () => {
		const { view, type, plugin } = setup();
		type("```py");

		expect(pressKey(view, "Enter", plugin)).toBe(true);
		expect(firstBlock(view).type.name).toBe("codeBlock");
		expect(firstBlock(view).attrs.language).toBe("py");
		expect(firstBlock(view).textContent).toBe("");
	});

	it("leaves Enter to other handlers when no rule matches", () => {
		const { view, type, plugin } = setup();
		type("plain");

		expect(pressKey(view, "Enter", plugin)).toBe(false);
	});

	it("turns '---' into a horizontal rule and moves the caret after it", () => {
		const { view, type } = setup();
		type("---after");

		expect(view.state.doc.child(0).type.name).toBe("thematicBreak");
		expect(view.state.doc.child(1).textContent).toBe("after");
		expect(markdownOf(view)).toBe("---\n\nafter\n");
	});

	it("does not convert block syntax in the middle of a paragraph", () => {
		const { view, type } = setup();
		type("see # this and - that");

		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("see # this and - that");
	});
});

describe("mark input rules", () => {
	it.each([
		["**bold**", "strong", "bold"],
		["__bold__", "strong", "bold"],
		["*it*", "emphasis", "it"],
		["_it_", "emphasis", "it"],
		["~~gone~~", "strikethrough", "gone"],
		["`code`", "inlineCode", "code"],
	])("turns %s into the %s mark and removes the delimiters", (typed, mark, text) => {
		const { view, type } = setup();
		type(`a ${typed}`);

		const paragraph = firstBlock(view);
		expect(paragraph.textContent).toBe(`a ${text}`);
		expect(paragraph.lastChild?.marks.map((m) => m.type.name)).toEqual([mark]);
	});

	it("does not carry the mark into text typed after the closing delimiter", () => {
		const { view, type } = setup();
		type("**bold** after");

		expect(markdownOf(view)).toBe("**bold** after\n");
	});

	it("leaves arithmetic and snake_case literal", () => {
		const { view, type } = setup();
		type("2 * 3 * 4 and snake_case_name");

		expect(markdownOf(view)).toBe("2 \\* 3 \\* 4 and snake\\_case\\_name\n");
		expect(firstBlock(view).childCount).toBe(1);
	});
});

describe("single undo restores the typed text", () => {
	it("returns a converted heading to the literal '# ', then removes the typing", () => {
		const { view, type } = setup();
		type("# ");

		expect(firstBlock(view).type.name).toBe("heading");

		undoOnce(view);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("# ");

		undoOnce(view);
		expect(firstBlock(view).textContent).toBe("");
	});

	it("returns a converted mark to its literal delimiters", () => {
		const { view, type } = setup();
		type("**bold**");

		undoOnce(view);
		expect(firstBlock(view).textContent).toBe("**bold**");
		expect(firstBlock(view).firstChild?.marks).toEqual([]);
	});

	it("keeps typing after a conversion in its own undo step", () => {
		const { view, type } = setup();
		type("# Title");

		undoOnce(view);
		expect(firstBlock(view).type.name).toBe("heading");
		expect(firstBlock(view).textContent).toBe("");

		undoOnce(view);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("# ");
	});

	it("treats Backspace right after a conversion as that single undo", () => {
		const { view, type, plugin } = setup();
		type("- ");

		expect(pressKey(view, "Backspace", plugin)).toBe(true);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("- ");
	});

	it("leaves Backspace alone once something else has been typed", () => {
		const { view, type, plugin } = setup();
		type("- a");

		expect(pressKey(view, "Backspace", plugin)).toBe(false);
	});
});

describe("suppression inside code", () => {
	it("keeps Markdown typed inside a code block literal", () => {
		const plugin = createInputRulesPlugin(INPUT_RULES, () => true);
		const doc = schema.node("doc", null, [schema.node("codeBlock")]);
		const view = createTestView(doc, [plugin], 1);

		typeText(view, "# **not bold** - x", plugin);

		expect(firstBlock(view).type.name).toBe("codeBlock");
		expect(firstBlock(view).textContent).toBe("# **not bold** - x");
	});

	it("keeps Markdown typed inside inline code literal", () => {
		const { view, type } = setup();
		type("a ");
		view.dispatch(view.state.tr.addStoredMark(schema.marks.inlineCode.create()));
		type("**x**");

		expect(firstBlock(view).textContent).toBe("a **x**");
		expect(firstBlock(view).lastChild?.marks.map((m) => m.type.name)).toEqual(["inlineCode"]);
	});
});

describe("the conversion setting", () => {
	it("keeps typed syntax literal when conversion is disabled", () => {
		const { view, type } = setup(false);
		type("# **x**");

		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("# **x**");
	});
});

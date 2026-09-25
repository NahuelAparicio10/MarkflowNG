import type { Node as PmNode } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";
import type { List } from "mdast";
import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown } from "../markdown";
import { createPmToMdast, createRegistry, mdastToPm, pmToMdast } from "../mapping";
import { createParagraphHandler } from "../mapping/handlers/paragraph";
import { textHandler } from "../mapping/handlers/text";
import { schema } from "../schema";
import { stripPositions } from "./helpers";

function toPm(source: string): PmNode {
	return mdastToPm(parseMarkdown(source));
}

function roundTrip(source: string): string {
	return serializeMarkdown(pmToMdast(toPm(source)));
}

function inlineNodes(block: PmNode): PmNode[] {
	const result: PmNode[] = [];
	block.forEach((child) => result.push(child));
	return result;
}

function markNames(node: PmNode): string[] {
	return node.marks.map((mark) => mark.type.name);
}

function paragraphOf(...inline: PmNode[]): PmNode {
	return schema.node("doc", null, [schema.node("paragraph", null, inline)]);
}

describe("marks map to ProseMirror marks, not preserved nodes", () => {
	it.each([
		["**bold**", "strong"],
		["*italic*", "emphasis"],
		["~~struck~~", "strikethrough"],
		["`code`", "inlineCode"],
		["[text](https://example.com)", "link"],
	])("%s carries the %s mark", (source, mark) => {
		const [node] = inlineNodes(toPm(`${source}\n`).child(0));

		expect(node.isText).toBe(true);
		expect(markNames(node)).toEqual([mark]);
	});

	it("keeps the link target and title as mark attributes", () => {
		const [node] = inlineNodes(toPm('[text](https://example.com "Title")\n').child(0));

		expect(node.marks[0].attrs).toEqual({ href: "https://example.com", title: "Title" });
	});

	it("gives overlapping marks to the same text", () => {
		const [node] = inlineNodes(toPm("***both***\n").child(0));

		expect(markNames(node).sort()).toEqual(["emphasis", "strong"]);
	});
});

describe("mark nesting is rebuilt when converting back to mdast", () => {
	it("keeps a longer mark outside a shorter one it contains", () => {
		const source = "*a **b** c*\n";
		const tree = pmToMdast(toPm(source));

		expect(stripPositions(tree)).toEqual(stripPositions(parseMarkdown(source)));
	});

	it("does not split a mark around a mark that starts inside it", () => {
		const source = "**Bold with *emphasis* inside**\n";

		expect(roundTrip(source)).toBe(source);
	});

	it("keeps code innermost, as a leaf", () => {
		const source = "**Bold `code` bold**\n";

		expect(roundTrip(source)).toBe(source);
	});

	it("moves whitespace at the edges of a mark outside it, so the output is still bold", () => {
		// A double-click selection on Windows includes the trailing space.
		const strong = schema.marks.strong.create();
		const doc = paragraphOf(schema.text("A "), schema.text("word ", [strong]), schema.text("here"));

		expect(serializeMarkdown(pmToMdast(doc))).toBe("A **word** here\n");
	});

	it("drops a mark that covers only whitespace", () => {
		const doc = paragraphOf(schema.text("a"), schema.text(" ", [schema.marks.emphasis.create()]), schema.text("b"));

		expect(pmToMdast(doc).children[0]).toEqual({
			type: "paragraph",
			children: [{ type: "text", value: "a b" }],
		});
	});

	it("nests marks covering exactly the same span in schema rank order", () => {
		// ProseMirror stores a set of marks per node, so two marks covering the
		// same span carry no nesting order of their own. Rank order decides, and
		// it is chosen to match the common forms: `***x***` parses as emphasis
		// around strong, and a link wraps its formatting.
		expect(roundTrip("***x***\n")).toBe("***x***\n");
		expect(roundTrip("[**x**](https://example.com)\n")).toBe("[**x**](https://example.com)\n");
		expect(roundTrip("**[x](https://example.com)**\n")).toBe("[**x**](https://example.com)\n");
	});

	it("throws rather than dropping a mark with no registered handler", () => {
		const withoutMarks = createRegistry([textHandler, createParagraphHandler(() => undefined)]);
		const doc = paragraphOf(schema.text("bold", [schema.marks.strong.create()]));

		expect(() => createPmToMdast(withoutMarks)(doc)).toThrow(/No mapping handler for ProseMirror mark type: strong/);
	});
});

describe("lists", () => {
	it("maps bulleted and ordered lists to one node type distinguished by an attribute", () => {
		const doc = toPm("- a\n\n<!---->\n\n3. b\n");
		const bullet = doc.child(0);
		const ordered = doc.child(2);

		expect(bullet.type.name).toBe("list");
		expect(bullet.attrs).toMatchObject({ ordered: false, start: null });
		expect(ordered.type.name).toBe("list");
		expect(ordered.attrs).toMatchObject({ ordered: true, start: 3 });
	});

	it("carries whether a list is loose", () => {
		expect(toPm("- a\n- b\n").child(0).attrs.spread).toBe(false);
		expect(toPm("- a\n\n- b\n").child(0).attrs.spread).toBe(true);
	});

	it("models a task item as a list item with a boolean checked state", () => {
		const list = toPm("- [ ] todo\n- [x] done\n- plain\n").child(0);

		expect(list.child(0).attrs.checked).toBe(false);
		expect(list.child(1).attrs.checked).toBe(true);
		expect(list.child(2).attrs.checked).toBe(null);
	});

	it("round-trips a toggled task item to the checked form", () => {
		const doc = toPm("- [ ] todo\n");
		// The list opens at 0, so its first item starts at 1.
		const item = doc.child(0).child(0);
		const toggled = new Transform(doc).setNodeMarkup(1, null, { ...item.attrs, checked: true }).doc;

		expect(serializeMarkdown(pmToMdast(toggled))).toBe("- [x] todo\n");
	});

	it("gives an empty list item a paragraph to type into, and serializes it back as empty", () => {
		const doc = toPm("- a\n-\n");
		const empty = doc.child(0).child(1);

		expect(empty.childCount).toBe(1);
		expect(empty.child(0).type.name).toBe("paragraph");
		expect((pmToMdast(doc).children[0] as List).children[1].children).toEqual([]);
	});
});

describe("code blocks", () => {
	it("stores the language and meta as attributes and the content as literal text", () => {
		const block = toPm('```js title="x.js"\nconst a = **1**;\n```\n').child(0);

		expect(block.type.name).toBe("codeBlock");
		expect(block.attrs).toEqual({ language: "js", meta: 'title="x.js"' });
		expect(block.textContent).toBe("const a = **1**;");
		expect(block.firstChild?.marks).toEqual([]);
	});

	it("serializes the language back into the fence", () => {
		const doc = schema.node("doc", null, [schema.node("codeBlock", { language: "rust" }, [schema.text("fn main() {}")])]);

		expect(serializeMarkdown(pmToMdast(doc))).toBe("```rust\nfn main() {}\n```\n");
	});
});

describe("blockquotes and thematic breaks", () => {
	it("keeps every block of a quote inside it", () => {
		const quote = toPm("> # Title\n>\n> One.\n>\n> Two.\n").child(0);

		expect(quote.type.name).toBe("blockquote");
		expect(quote.childCount).toBe(3);
	});

	it("maps a thematic break to a leaf node", () => {
		const doc = toPm("a\n\n---\n\nb\n");

		expect(doc.child(1).type.name).toBe("thematicBreak");
		expect(doc.child(1).isLeaf).toBe(true);
		expect(roundTrip("a\n\n---\n\nb\n")).toBe("a\n\n---\n\nb\n");
	});
});

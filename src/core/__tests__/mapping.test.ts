import type { Node as PmNode } from "@tiptap/pm/model";
import type { Heading, Root } from "mdast";
import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown } from "../markdown";
import { mdastToPm, pmToMdast, registry } from "../mapping";
import { createPmToMdast } from "../mapping/pmToMdast";
import { schema } from "../schema";

function roundTripTree(source: string): Root {
	return pmToMdast(mdastToPm(parseMarkdown(source)));
}

function firstChild(doc: PmNode): PmNode {
	return doc.child(0);
}

describe("mapping registry", () => {
	it("registers every handler in both directions", () => {
		// Handlers are registered as pairs, so a one-directional handler cannot be
		// expressed. This asserts the two lookup tables stay in agreement.
		expect(registry.byMdastType.size).toBe(registry.byPmType.size);

		for (const [mdastType, pair] of registry.byMdastType) {
			expect(pair.mdastType).toBe(mdastType);
			expect(registry.byPmType.get(pair.pmType)).toBe(pair);
			expect(typeof pair.toPm).toBe("function");
			expect(typeof pair.toMdast).toBe("function");
		}
	});

	it("covers the node types this change makes editable", () => {
		expect([...registry.byMdastType.keys()].sort()).toEqual(["heading", "paragraph", "text"]);
	});
});

describe("mdastToPm", () => {
	it("maps headings with their level", () => {
		const doc = mdastToPm(parseMarkdown("### Design\n"));
		const heading = firstChild(doc);

		expect(heading.type.name).toBe("heading");
		expect(heading.attrs.level).toBe(3);
		expect(heading.textContent).toBe("Design");
	});

	it("maps paragraphs", () => {
		const doc = mdastToPm(parseMarkdown("Body text\n"));

		expect(firstChild(doc).type.name).toBe("paragraph");
		expect(firstChild(doc).textContent).toBe("Body text");
	});

	it("produces a schema-valid document", () => {
		const doc = mdastToPm(parseMarkdown("# Title\n\nBody\n"));

		expect(() => doc.check()).not.toThrow();
	});

	it("produces a valid document for empty input", () => {
		const doc = mdastToPm(parseMarkdown(""));

		expect(() => doc.check()).not.toThrow();
	});

	it("rejects a heading depth outside 1 to 6", () => {
		const tree: Root = {
			type: "root",
			children: [{ type: "heading", depth: 9 as Heading["depth"], children: [] }],
		};

		expect(() => mdastToPm(tree)).toThrow(RangeError);
	});
});

describe("pmToMdast", () => {
	it("is the inverse of mdastToPm for headings", () => {
		const tree = roundTripTree("### Design\n");
		const heading = tree.children[0] as Heading;

		expect(heading.type).toBe("heading");
		expect(heading.depth).toBe(3);
		expect(heading.children[0]).toMatchObject({ type: "text", value: "Design" });
	});

	it("is the inverse of mdastToPm for paragraphs", () => {
		const tree = roundTripTree("Body text\n");

		expect(tree.children[0]).toMatchObject({
			type: "paragraph",
			children: [{ type: "text", value: "Body text" }],
		});
	});

	it("throws rather than guessing for an unmapped ProseMirror node type", () => {
		// A node type in the schema with no registered handler is a programming
		// error, not user content, so it must fail loudly.
		const doc = schema.node("doc", null, [schema.node("paragraph")]);
		const stripped = { ...registry, byPmType: new Map() };

		expect(() => createPmToMdast(stripped)(doc)).toThrow(/No mapping handler/);
	});
});

describe("preservation of unsupported content", () => {
	it("preserves a GFM table through a full round-trip", () => {
		const source = "| a | b |\n| - | - |\n| 1 | 2 |\n";

		expect(serializeMarkdown(roundTripTree(source))).toBe(source);
	});

	it("preserves YAML frontmatter through a full round-trip", () => {
		const source = "---\ntitle: Doc\n---\n\nBody\n";

		expect(serializeMarkdown(roundTripTree(source))).toBe(source);
	});

	it("preserves a fenced code block through a full round-trip", () => {
		const source = "```ts\nconst x = 1;\n```\n";

		expect(serializeMarkdown(roundTripTree(source))).toBe(source);
	});

	it("preserves inline content inside a paragraph", () => {
		const source = "Text with *emphasis* and `code`.\n";

		expect(serializeMarkdown(roundTripTree(source))).toBe(source);
	});

	it("uses a block preservation node for block content", () => {
		const doc = mdastToPm(parseMarkdown("| a |\n| - |\n| 1 |\n"));

		expect(firstChild(doc).type.name).toBe("preserved");
	});

	it("uses an inline preservation node for phrasing content", () => {
		const doc = mdastToPm(parseMarkdown("Text with *emphasis*.\n"));
		const paragraph = firstChild(doc);
		const types = new Set<string>();

		paragraph.forEach((child) => types.add(child.type.name));

		expect(types.has("preservedInline")).toBe(true);
		expect(types.has("preserved")).toBe(false);
	});

	it("stores the preserved subtree as plain data", () => {
		const doc = mdastToPm(parseMarkdown("| a |\n| - |\n| 1 |\n"));
		const stored = firstChild(doc).attrs.mdast;

		expect(stored).toEqual(structuredClone(stored));
	});

	it("does not alias the source tree, so later edits cannot mutate it", () => {
		const tree = parseMarkdown("| a |\n| - |\n| 1 |\n");
		const doc = mdastToPm(tree);

		expect(firstChild(doc).attrs.mdast).not.toBe(tree.children[0]);
	});
});

import { describe, expect, it } from "vitest";
import { HEADING_LEVELS, schema } from "../schema";

describe("schema", () => {
	it("defines the editable node set", () => {
		expect(Object.keys(schema.nodes).sort()).toEqual([
			"blockquote",
			"codeBlock",
			"doc",
			"heading",
			"list",
			"listItem",
			"paragraph",
			"preserved",
			"preservedInline",
			"text",
			"thematicBreak",
		]);
	});

	it("defines the inline marks, ranked so code is innermost", () => {
		expect(Object.keys(schema.marks)).toEqual(["link", "emphasis", "strong", "strikethrough", "inlineCode"]);
	});

	it("stores the code block language as a schema attribute", () => {
		const node = schema.node("codeBlock", { language: "ts" }, [schema.text("const x = 1;")]);

		expect(node.attrs.language).toBe("ts");
		expect(schema.nodes.codeBlock.spec.attrs).toHaveProperty("language");
	});

	it("renders the code block language as data, not as a class name", () => {
		const node = schema.node("codeBlock", { language: "ts" });
		const rendered = JSON.stringify(schema.nodes.codeBlock.spec.toDOM?.(node));

		expect(rendered).not.toContain("class");
		expect(rendered).toContain('"data-language":"ts"');
	});

	it("models a task item as a list item with a checked state, not a separate list type", () => {
		const list = schema.node("list", { ordered: false }, [
			schema.node("listItem", { checked: false }, [schema.node("paragraph", null, [schema.text("todo")])]),
			schema.node("listItem", null, [schema.node("paragraph", null, [schema.text("plain")])]),
		]);

		expect(() => list.check()).not.toThrow();
		expect(Object.keys(schema.nodes).some((name) => /task/i.test(name))).toBe(false);
	});

	it("allows no marks inside a code block", () => {
		expect(schema.nodes.codeBlock.allowsMarkType(schema.marks.strong)).toBe(false);
	});

	it("accepts a document of a heading and a paragraph", () => {
		const doc = schema.node("doc", null, [
			schema.node("heading", { level: 2 }, [schema.text("Design")]),
			schema.node("paragraph", null, [schema.text("Body text")]),
		]);

		expect(() => doc.check()).not.toThrow();
		expect(doc.childCount).toBe(2);
	});

	it("accepts every heading level from 1 to 6", () => {
		for (const level of HEADING_LEVELS) {
			expect(() => schema.node("heading", { level }, [schema.text(`H${level}`)])).not.toThrow();
		}
	});

	// ProseMirror applies attribute validators in `check()` and in `fromJSON`,
	// not in `schema.node()`, so those are the points asserted here. The mapping
	// additionally rejects out-of-range levels at their real entry point, which
	// is an mdast heading depth; see the heading handler.
	it("rejects a heading level above 6", () => {
		const node = schema.node("heading", { level: 7 }, [schema.text("Too deep")]);

		expect(() => node.check()).toThrow();
	});

	it("rejects a heading level below 1", () => {
		const node = schema.node("heading", { level: 0 }, [schema.text("Too shallow")]);

		expect(() => node.check()).toThrow();
	});

	it("rejects a non-numeric heading level", () => {
		const node = schema.node("heading", { level: "2" }, [schema.text("Stringly typed")]);

		expect(() => node.check()).toThrow();
	});

	it("rejects an out-of-range heading level arriving from serialized state", () => {
		expect(() =>
			schema.nodeFromJSON({
				type: "heading",
				attrs: { level: 9 },
				content: [{ type: "text", text: "From JSON" }],
			}),
		).toThrow();
	});

	it("requires a document to contain at least one block", () => {
		expect(() => schema.node("doc", null, []).check()).toThrow();
	});
});

import type { Heading, Paragraph, Root, Yaml } from "mdast";
import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown } from "../markdown";

describe("parseMarkdown", () => {
	it("parses headings and paragraphs", () => {
		const tree = parseMarkdown("# Title\n\nBody text\n");

		expect(tree.type).toBe("root");
		expect(tree.children).toHaveLength(2);

		const heading = tree.children[0] as Heading;
		expect(heading.type).toBe("heading");
		expect(heading.depth).toBe(1);
		expect(heading.children[0]).toMatchObject({ type: "text", value: "Title" });

		const paragraph = tree.children[1] as Paragraph;
		expect(paragraph.type).toBe("paragraph");
		expect(paragraph.children[0]).toMatchObject({ type: "text", value: "Body text" });
	});

	it("parses every heading level", () => {
		const source = [1, 2, 3, 4, 5, 6].map((n) => `${"#".repeat(n)} H${n}`).join("\n\n");
		const tree = parseMarkdown(`${source}\n`);

		const depths = tree.children.map((node) => (node as Heading).depth);
		expect(depths).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("parses GFM tables as structure, not text", () => {
		const tree = parseMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n");

		expect(tree.children[0]).toMatchObject({ type: "table" });
	});

	it("parses GFM strikethrough", () => {
		const tree = parseMarkdown("~~gone~~\n");
		const paragraph = tree.children[0] as Paragraph;

		expect(paragraph.children[0]).toMatchObject({ type: "delete" });
	});

	it("parses GFM task list items with their checked state", () => {
		const tree = parseMarkdown("- [ ] todo\n- [x] done\n");
		const list = tree.children[0] as Root["children"][number] & {
			children: { checked: boolean | null }[];
		};

		expect(list.children[0].checked).toBe(false);
		expect(list.children[1].checked).toBe(true);
	});

	it("parses YAML frontmatter as a yaml node, not a thematic break", () => {
		const tree = parseMarkdown("---\ntitle: Doc\n---\n\nBody\n");

		const first = tree.children[0] as Yaml;
		expect(first.type).toBe("yaml");
		expect(first.value).toBe("title: Doc");
		expect(tree.children.some((node) => node.type === "thematicBreak")).toBe(false);
	});

	it("parses an empty document", () => {
		const tree = parseMarkdown("");

		expect(tree.type).toBe("root");
		expect(tree.children).toHaveLength(0);
	});
});

describe("serializeMarkdown", () => {
	it("is deterministic across repeated calls", () => {
		const tree = parseMarkdown("# Title\n\nBody text\n");

		expect(serializeMarkdown(tree)).toBe(serializeMarkdown(tree));
	});

	it("reproduces a normalized document exactly", () => {
		const source = "# Title\n\nBody text\n";

		expect(serializeMarkdown(parseMarkdown(source))).toBe(source);
	});

	it("emits the pinned normal form regardless of the input form", () => {
		// Asterisk bullets and underscore emphasis are valid input but are not the
		// normal form; the pinned options must rewrite them.
		const output = serializeMarkdown(parseMarkdown("* one\n* two\n"));

		expect(output).toBe("- one\n- two\n");
	});

	it("round-trips GFM constructs it does not yet make editable", () => {
		const source = "| a | b |\n| - | - |\n| 1 | 2 |\n";

		expect(serializeMarkdown(parseMarkdown(source))).toBe(source);
	});

	it("round-trips YAML frontmatter", () => {
		const source = "---\ntitle: Doc\n---\n\nBody\n";

		expect(serializeMarkdown(parseMarkdown(source))).toBe(source);
	});
});

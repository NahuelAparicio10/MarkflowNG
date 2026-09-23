import type { Node as PmNode } from "@tiptap/pm/model";
import { Transform } from "@tiptap/pm/transform";
import { describe, expect, it } from "vitest";
import { decodeTitle, encodeTitle } from "../images/titleSize";
import { mdastToPm, pmToMdast } from "../mapping";
import { parseMarkdown, serializeMarkdown } from "../markdown";

function toPm(source: string): PmNode {
	return mdastToPm(parseMarkdown(source));
}

function roundTrip(source: string): string {
	return serializeMarkdown(pmToMdast(toPm(source)));
}

function firstImage(doc: PmNode): { node: PmNode; pos: number } {
	let found: { node: PmNode; pos: number } | null = null;
	doc.descendants((node, pos) => {
		if (!found && node.type.name === "image") {
			found = { node, pos };
		}
		return found === null;
	});

	if (!found) {
		throw new Error("No image in document");
	}

	return found;
}

describe("image nodes", () => {
	it("map to an inline image node, not a preserved one", () => {
		const { node } = firstImage(toPm("Before ![Diagram](assets/a.png) after.\n"));

		expect(node.type.name).toBe("image");
		expect(node.isInline).toBe(true);
		expect(node.attrs).toEqual({ src: "assets/a.png", alt: "Diagram", title: null, width: null });
	});

	it.each([
		"![Diagram](diagram.png)\n",
		"![](no-alt.png)\n",
		"![Up](../shared/logo.svg)\n",
		"![Spaces](<assets/boss arena.png>)\n",
		"![Remote](https://example.com/a.png?x=1\\&y=2)\n",
		'![Titled](a.png "Another tool\'s caption")\n',
		"[![Linked](thumb.png)](full.png)\n",
	])("leaves %j byte-identical through a round trip", (source) => {
		expect(roundTrip(source)).toBe(source);
	});

	it("stores edited alt text in the serialized Markdown", () => {
		const doc = toPm("![old](a.png)\n");
		const { node, pos } = firstImage(doc);
		const edited = new Transform(doc).setNodeMarkup(pos, null, { ...node.attrs, alt: "New description" }).doc;

		expect(serializeMarkdown(pmToMdast(edited))).toBe("![New description](a.png)\n");
	});
});

describe("display size in the title field", () => {
	it("decodes an encoded width into its own attribute", () => {
		const { node } = firstImage(toPm('![a](a.png "Arena | width=640")\n'));

		expect(node.attrs.title).toBe("Arena");
		expect(node.attrs.width).toBe(640);
	});

	it("adds no title to an image that was never resized", () => {
		expect(roundTrip("![a](a.png)\n")).toBe("![a](a.png)\n");
	});

	it("persists a resize in the title, as plain Markdown with no HTML", () => {
		const doc = toPm("![a](a.png)\n");
		const { node, pos } = firstImage(doc);
		const resized = new Transform(doc).setNodeMarkup(pos, null, { ...node.attrs, width: 320 }).doc;
		const output = serializeMarkdown(pmToMdast(resized));

		expect(output).toBe('![a](a.png "width=320")\n');
		expect(output).not.toMatch(/<img/i);
		expect(firstImage(toPm(output)).node.attrs.width).toBe(320);
	});

	it("keeps a foreign title alongside a resize", () => {
		const doc = toPm('![a](a.png "Caption")\n');
		const { node, pos } = firstImage(doc);
		const resized = new Transform(doc).setNodeMarkup(pos, null, { ...node.attrs, width: 200 }).doc;

		expect(serializeMarkdown(pmToMdast(resized))).toBe('![a](a.png "Caption | width=200")\n');
	});

	it.each([
		["a foreign title", "Taken by another tool"],
		["a near miss without the exact separator", "Caption |width=320"],
		["a leading zero", "width=0320"],
		["an empty title", ""],
		["a width beyond the safe integer range", "width=99999999999999999999"],
	])("treats %s as foreign and preserves it unchanged", (_label, title) => {
		expect(decodeTitle(title)).toEqual({ title, width: null });
		expect(encodeTitle(title, null)).toBe(title);
	});

	it.each(["width=1", "width=480", "Arena | width=640", "a | width=1 | width=2", "multi\nline | width=5"])(
		"decodes and re-encodes %j to exactly the same title",
		(title) => {
			const { title: human, width } = decodeTitle(title);

			expect(encodeTitle(human, width)).toBe(title);
		},
	);
});

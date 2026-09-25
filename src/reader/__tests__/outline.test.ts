import type { Heading } from "mdast";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { deriveOutline } from "../outline";

describe("deriveOutline", () => {
	it("lists every heading in document order, indented by level", () => {
		const tree = parseMarkdown("# One\n\n## Two\n\n### Three\n\n## Four\n");

		const { entries } = deriveOutline(tree);

		expect(entries).toEqual([
			{ id: "one", text: "One", depth: 1 },
			{ id: "two", text: "Two", depth: 2 },
			{ id: "three", text: "Three", depth: 3 },
			{ id: "four", text: "Four", depth: 2 },
		]);
	});

	it("assigns a stable, unique slug per heading, including duplicate text", () => {
		const tree = parseMarkdown("# Overview\n\n## Overview\n\n## Overview\n");

		const { entries } = deriveOutline(tree);

		expect(entries.map((entry) => entry.id)).toEqual(["overview", "overview-1", "overview-2"]);
	});

	it("is empty and does not error for a document with no headings", () => {
		const tree = parseMarkdown("Just a paragraph.\n");

		expect(() => deriveOutline(tree)).not.toThrow();
		expect(deriveOutline(tree).entries).toEqual([]);
	});

	it("is empty for an empty document", () => {
		const tree = parseMarkdown("");

		expect(deriveOutline(tree).entries).toEqual([]);
	});

	it("maps each heading node to its slug id by identity", () => {
		const tree = parseMarkdown("# Title\n");
		const heading = tree.children[0] as Heading;

		const { idsByHeading } = deriveOutline(tree);

		expect(idsByHeading.get(heading)).toBe("title");
	});

	it("finds headings nested inside a blockquote", () => {
		const tree = parseMarkdown("> # Quoted heading\n");

		const { entries } = deriveOutline(tree);

		expect(entries).toEqual([{ id: "quoted-heading", text: "Quoted heading", depth: 1 }]);
	});

	it("does not mutate the tree", () => {
		const tree = parseMarkdown("# One\n\n## Two\n");
		const before = JSON.stringify(tree);

		deriveOutline(tree);

		expect(JSON.stringify(tree)).toBe(before);
	});
});

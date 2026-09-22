import type { Heading, PhrasingContent, Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";

export interface OutlineEntry {
	id: string;
	text: string;
	depth: Heading["depth"];
}

export interface Outline {
	entries: readonly OutlineEntry[];
	/** Stable DOM anchor id per heading node, keyed by node identity. */
	idsByHeading: ReadonlyMap<Heading, string>;
}

export const EMPTY_OUTLINE: Outline = { entries: [], idsByHeading: new Map() };

/**
 * Derives a navigable outline from every heading in the tree, in document
 * order, including headings nested inside blockquotes or list items.
 *
 * Read-only: neither the tree nor its nodes are modified. The slug id lives
 * in a side map instead of being written onto the node, which is what keeps
 * this safe to call on the same tree more than once.
 */
export function deriveOutline(tree: Root): Outline {
	const entries: OutlineEntry[] = [];
	const idsByHeading = new Map<Heading, string>();
	const seen = new Map<string, number>();

	visit(tree, "heading", (node: Heading) => {
		const text = headingText(node);
		const id = uniqueSlug(slugify(text), seen);

		idsByHeading.set(node, id);
		entries.push({ id, text, depth: node.depth });
	});

	return { entries, idsByHeading };
}

function headingText(node: Heading): string {
	return node.children.map(nodeText).join("");
}

function nodeText(node: PhrasingContent | RootContent): string {
	switch (node.type) {
		case "text":
		case "inlineCode":
			return node.value;
		case "break":
			return " ";
		case "html":
			return "";
		default:
			return "children" in node ? node.children.map(nodeText).join("") : "";
	}
}

function slugify(text: string): string {
	const slug = text
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	return slug.length > 0 ? slug : "section";
}

/** Appends `-1`, `-2`, … to a slug already seen, GitHub-style. */
function uniqueSlug(base: string, seen: Map<string, number>): string {
	const count = seen.get(base) ?? 0;
	seen.set(base, count + 1);
	return count === 0 ? base : `${base}-${count}`;
}

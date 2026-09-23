import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import type { BlockContent, DefinitionContent, RootContent } from "mdast";

/**
 * Container nodes (list items, quotes) require at least one block in
 * ProseMirror so the caret has somewhere to go, but mdast allows them to be
 * empty: `-` on its own line is an item with no children. An empty mdast
 * container becomes one empty paragraph, and one empty paragraph becomes an
 * empty container again, which serializes identically.
 */
export function containerToPm(children: PmNode[], schema: Schema): PmNode[] {
	return children.length > 0 ? children : [schema.node("paragraph")];
}

export function containerToMdast(children: RootContent[]): (BlockContent | DefinitionContent)[] {
	const [only] = children;

	if (children.length === 1 && only.type === "paragraph" && only.children.length === 0) {
		return [];
	}

	return children as (BlockContent | DefinitionContent)[];
}

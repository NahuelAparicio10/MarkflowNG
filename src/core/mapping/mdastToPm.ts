import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import type { Parent, Root, RootContent } from "mdast";
import { findByMdastType } from "./registry";
import type { MappingRegistry, MdastToPmContext } from "./types";

/**
 * Converts a canonical mdast tree into a ProseMirror document.
 *
 * Dispatch goes through the registry, so a node type is supported by
 * contributing a handler pair rather than by editing this file. Node types with
 * no registered handler fall through to the preservation node, which carries
 * the original subtree so that nothing is ever silently dropped.
 */
export function createMdastToPm(registry: MappingRegistry, schema: Schema) {
	function convertNode(node: RootContent, inline = false): PmNode[] {
		const handler = findByMdastType(registry, node.type);

		if (handler) {
			return handler.toPm(node, context);
		}

		return [preserve(node, inline)];
	}

	function convertChildren(parent: Parent, inline = false): PmNode[] {
		return parent.children.flatMap((child) => convertNode(child, inline));
	}

	function preserve(node: RootContent, inline: boolean): PmNode {
		const type = inline ? "preservedInline" : "preserved";

		return schema.node(type, { mdast: structuredClone(node) });
	}

	const context: MdastToPmContext = { schema, convertChildren, convertNode };

	return function mdastToPm(tree: Root): PmNode {
		const content = convertChildren(tree);

		// The schema requires at least one block, and an empty Markdown file
		// parses to a root with no children.
		if (content.length === 0) {
			return schema.node("doc", null, [schema.node("paragraph")]);
		}

		return schema.node("doc", null, content);
	};
}

import type { Node as PmNode } from "@tiptap/pm/model";
import type { Root, RootContent } from "mdast";
import { findByPmType } from "./registry";
import type { MappingRegistry, PmToMdastContext } from "./types";

/**
 * Converts a ProseMirror document back into a canonical mdast tree.
 *
 * The inverse of `mdastToPm`. Preservation nodes return the mdast subtree they
 * were carrying, verbatim, which is what lets a document containing constructs
 * the schema does not model survive an edit-and-save cycle intact.
 */
export function createPmToMdast(registry: MappingRegistry) {
	function convertNode(node: PmNode): RootContent[] {
		// Both preservation nodes return their subtree verbatim. They differ only
		// in ProseMirror's block/inline distinction, which is irrelevant here
		// because the mdast they carry already knows what it is.
		if (node.type.name === "preserved" || node.type.name === "preservedInline") {
			return [structuredClone(node.attrs.mdast as RootContent)];
		}

		const handler = findByPmType(registry, node.type.name);

		if (!handler) {
			throw new Error(`No mapping handler for ProseMirror node type: ${node.type.name}`);
		}

		return handler.toMdast(node, context);
	}

	function convertChildren(node: PmNode): RootContent[] {
		const children: RootContent[] = [];

		node.forEach((child) => {
			children.push(...convertNode(child));
		});

		return children;
	}

	const context: PmToMdastContext = { convertChildren, convertNode };

	return function pmToMdast(doc: PmNode): Root {
		return { type: "root", children: convertChildren(doc) };
	};
}

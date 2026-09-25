import type { InlineCode } from "mdast";
import { defineNodeHandler } from "../registry";

/**
 * A leaf in mdast but a mark in ProseMirror, so that code can sit inside
 * other formatting and be edited as text. The phrasing conversion treats it as
 * a leaf because its mark spec sets `code`, and calls `toMdast` with the text
 * node it covers.
 */
export const inlineCodeHandler = defineNodeHandler<InlineCode>({
	mdastType: "inlineCode",
	pmType: "inlineCode",

	toPm(node, { schema }) {
		// ProseMirror forbids empty text nodes.
		if (node.value === "") {
			return [];
		}

		return [schema.text(node.value, [schema.marks.inlineCode.create()])];
	},

	toMdast(node) {
		return [{ type: "inlineCode", value: node.text ?? "" }];
	},
});

import type { Text } from "mdast";
import { defineNodeHandler } from "../registry";

export const textHandler = defineNodeHandler<Text>({
	mdastType: "text",
	pmType: "text",

	toPm(node, { schema }) {
		// ProseMirror forbids empty text nodes, and mdast can produce them.
		if (node.value === "") {
			return [];
		}

		return [schema.text(node.value)];
	},

	toMdast(node) {
		return [{ type: "text", value: node.text ?? "" }];
	},
});

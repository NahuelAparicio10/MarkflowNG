import type { Paragraph, PhrasingContent } from "mdast";
import { defineNodeHandler } from "../registry";

export const paragraphHandler = defineNodeHandler<Paragraph>({
	mdastType: "paragraph",
	pmType: "paragraph",

	toPm(node, { schema, convertChildren }) {
		return [schema.node("paragraph", null, convertChildren(node, true))];
	},

	toMdast(node, { convertChildren }) {
		return [
			{
				type: "paragraph",
				children: convertChildren(node) as PhrasingContent[],
			},
		];
	},
});

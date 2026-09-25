import type { PhrasingContent, Strong } from "mdast";
import { defineNodeHandler } from "../registry";
import { addMark } from "./phrasing";

export const strongHandler = defineNodeHandler<Strong>({
	mdastType: "strong",
	pmType: "strong",

	toPm(node, { schema, convertChildren }) {
		return addMark(convertChildren(node, true), schema.marks.strong.create());
	},

	toMdast(node, { convertChildren }) {
		return [{ type: "strong", children: convertChildren(node) as PhrasingContent[] }];
	},
});

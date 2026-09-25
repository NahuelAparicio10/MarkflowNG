import type { Delete, PhrasingContent } from "mdast";
import { defineNodeHandler } from "../registry";
import { addMark } from "./phrasing";

/** GFM strikethrough, which mdast calls `delete`. */
export const strikethroughHandler = defineNodeHandler<Delete>({
	mdastType: "delete",
	pmType: "strikethrough",

	toPm(node, { schema, convertChildren }) {
		return addMark(convertChildren(node, true), schema.marks.strikethrough.create());
	},

	toMdast(node, { convertChildren }) {
		return [{ type: "delete", children: convertChildren(node) as PhrasingContent[] }];
	},
});

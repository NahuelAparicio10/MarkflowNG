import type { Emphasis, PhrasingContent } from "mdast";
import { defineNodeHandler } from "../registry";
import { addMark } from "./phrasing";

export const emphasisHandler = defineNodeHandler<Emphasis>({
	mdastType: "emphasis",
	pmType: "emphasis",

	toPm(node, { schema, convertChildren }) {
		return addMark(convertChildren(node, true), schema.marks.emphasis.create());
	},

	toMdast(node, { convertChildren }) {
		return [{ type: "emphasis", children: convertChildren(node) as PhrasingContent[] }];
	},
});

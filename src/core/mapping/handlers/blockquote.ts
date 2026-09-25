import type { Blockquote } from "mdast";
import { defineNodeHandler } from "../registry";
import { containerToMdast, containerToPm } from "./blockContent";

export const blockquoteHandler = defineNodeHandler<Blockquote>({
	mdastType: "blockquote",
	pmType: "blockquote",

	toPm(node, { schema, convertChildren }) {
		return [schema.node("blockquote", null, containerToPm(convertChildren(node), schema))];
	},

	toMdast(node, { convertChildren }) {
		return [{ type: "blockquote", children: containerToMdast(convertChildren(node)) }];
	},
});

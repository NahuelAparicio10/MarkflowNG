import type { ThematicBreak } from "mdast";
import { defineNodeHandler } from "../registry";

export const thematicBreakHandler = defineNodeHandler<ThematicBreak>({
	mdastType: "thematicBreak",
	pmType: "thematicBreak",

	toPm(_node, { schema }) {
		return [schema.node("thematicBreak")];
	},

	toMdast() {
		return [{ type: "thematicBreak" }];
	},
});

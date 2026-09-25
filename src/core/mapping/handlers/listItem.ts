import type { ListItem } from "mdast";
import { defineNodeHandler } from "../registry";
import { containerToMdast, containerToPm } from "./blockContent";

/** Plain and task items alike: a task item is one whose `checked` is a boolean. */
export const listItemHandler = defineNodeHandler<ListItem>({
	mdastType: "listItem",
	pmType: "listItem",

	toPm(node, { schema, convertChildren }) {
		const attrs = { checked: node.checked ?? null, spread: node.spread ?? false };

		return [schema.node("listItem", attrs, containerToPm(convertChildren(node), schema))];
	},

	toMdast(node, { convertChildren }) {
		return [
			{
				type: "listItem",
				checked: node.attrs.checked as boolean | null,
				spread: node.attrs.spread as boolean,
				children: containerToMdast(convertChildren(node)),
			},
		];
	},
});

import type { List, ListItem } from "mdast";
import { defineNodeHandler } from "../registry";

/**
 * Bulleted and numbered lists share one node type on both sides, distinguished
 * by `ordered`. See the `list` node spec for why there is not one type each.
 */
export const listHandler = defineNodeHandler<List>({
	mdastType: "list",
	pmType: "list",

	toPm(node, { schema, convertChildren }) {
		const attrs = {
			ordered: node.ordered ?? false,
			start: node.start ?? null,
			spread: node.spread ?? false,
		};

		return [schema.node("list", attrs, convertChildren(node))];
	},

	toMdast(node, { convertChildren }) {
		return [
			{
				type: "list",
				ordered: node.attrs.ordered as boolean,
				start: node.attrs.start as number | null,
				spread: node.attrs.spread as boolean,
				children: convertChildren(node) as ListItem[],
			},
		];
	},
});

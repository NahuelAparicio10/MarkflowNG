import type { Paragraph } from "mdast";
import { defineNodeHandler } from "../registry";
import { type HandlerLookup, phrasingToMdast } from "./phrasing";

/**
 * A factory rather than a constant because converting inline content back to
 * mdast needs the mark handlers, which the composition entry point supplies.
 */
export function createParagraphHandler(lookup: HandlerLookup) {
	return defineNodeHandler<Paragraph>({
		mdastType: "paragraph",
		pmType: "paragraph",

		toPm(node, { schema, convertChildren }) {
			return [schema.node("paragraph", null, convertChildren(node, true))];
		},

		toMdast(node, context) {
			return [
				{
					type: "paragraph",
					children: phrasingToMdast(node, context, lookup),
				},
			];
		},
	});
}

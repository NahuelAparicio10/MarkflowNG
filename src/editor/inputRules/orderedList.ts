import { wrapParagraph } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/** `1. `, or any number, at the start of a paragraph starts a numbered list from it. */
export const orderedListRule: MarkdownInputRule = {
	name: "orderedList",
	pattern: /^(\d{1,9})\. $/,

	apply({ state, match, from, to }) {
		return wrapParagraph(state, from, to, state.schema.nodes.list, { ordered: true, start: Number(match[1]) });
	},
};

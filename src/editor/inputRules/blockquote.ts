import { wrapParagraph } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/** `> ` at the start of a paragraph wraps it in a quote. */
export const blockquoteRule: MarkdownInputRule = {
	name: "blockquote",
	pattern: /^> $/,

	apply({ state, from, to }) {
		return wrapParagraph(state, from, to, state.schema.nodes.blockquote);
	},
};

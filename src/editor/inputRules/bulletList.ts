import { wrapParagraph } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/** `- `, `* ` or `+ ` at the start of a paragraph starts a bulleted list. */
export const bulletListRule: MarkdownInputRule = {
	name: "bulletList",
	pattern: /^[-*+] $/,

	apply({ state, from, to }) {
		return wrapParagraph(state, from, to, state.schema.nodes.list, { ordered: false, start: null });
	},
};

import { deleteParagraphPrefix } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/**
 * ` ``` ` at the start of a paragraph, optionally followed by a language,
 * becomes a code block when followed by a space or Enter. It does not fire on
 * the third backtick, so a language can still be typed after it.
 */
export const codeBlockRule: MarkdownInputRule = {
	name: "codeBlock",
	pattern: /^```([^`\s]*)[ \n]$/,
	onEnter: true,

	apply({ state, match, from, to }) {
		const tr = deleteParagraphPrefix(state, from, to);
		const language = match[1] === "" ? null : match[1];

		return tr?.setBlockType(from, from, state.schema.nodes.codeBlock, { language }) ?? null;
	},
};

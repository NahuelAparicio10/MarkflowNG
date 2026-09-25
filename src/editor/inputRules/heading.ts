import { deleteParagraphPrefix } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/** `# ` to `###### ` at the start of a paragraph makes it a heading of that level. */
export const headingRule: MarkdownInputRule = {
	name: "heading",
	pattern: /^(#{1,6}) $/,

	apply({ state, match, from, to }) {
		const tr = deleteParagraphPrefix(state, from, to);

		return tr?.setBlockType(from, from, state.schema.nodes.heading, { level: match[1].length }) ?? null;
	},
};

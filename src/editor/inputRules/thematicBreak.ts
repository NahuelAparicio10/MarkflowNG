import { TextSelection } from "@tiptap/pm/state";
import type { MarkdownInputRule } from "./types";

/**
 * `---` as the whole content of a paragraph becomes a horizontal rule, with the
 * caret moved to a new paragraph after it. It fires on the third hyphen, since
 * nothing else can follow on the line.
 */
export const thematicBreakRule: MarkdownInputRule = {
	name: "thematicBreak",
	pattern: /^---$/,

	apply({ state, from, to }) {
		const $from = state.doc.resolve(from);
		const paragraph = $from.parent;

		if (paragraph.type !== state.schema.nodes.paragraph || paragraph.content.size !== to - from) {
			return null;
		}

		const before = $from.before();
		const tr = state.tr.replaceWith(before, $from.after(), [
			state.schema.nodes.thematicBreak.create(),
			state.schema.nodes.paragraph.create(),
		]);

		// The rule is a leaf of size 1, so the new paragraph opens right after it.
		return tr.setSelection(TextSelection.create(tr.doc, before + 2));
	},
};

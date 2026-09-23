import { deleteParagraphPrefix, wrapParagraph } from "./blockRule";
import type { MarkdownInputRule } from "./types";

/**
 * `[ ] ` or `[x] ` at the start of a paragraph makes a task item.
 *
 * Typed as `- [ ] `, the `- ` has already made a list item by the time the
 * brackets arrive, so in the first paragraph of a plain list item this turns
 * that item into a task item. Anywhere else it starts a new bulleted list whose
 * item is a task item. Either way the task state lives on the list item — see
 * design decision D7.
 */
export const taskItemRule: MarkdownInputRule = {
	name: "taskItem",
	pattern: /^\[([ xX])\] $/,

	apply({ state, match, from, to }) {
		const checked = match[1] !== " ";
		const $from = state.doc.resolve(from);
		const itemDepth = $from.depth - 1;
		const item = $from.node(itemDepth);

		const isFirstBlockOfPlainItem =
			item.type === state.schema.nodes.listItem && item.attrs.checked === null && $from.index(itemDepth) === 0;

		if (isFirstBlockOfPlainItem) {
			const tr = deleteParagraphPrefix(state, from, to);

			return tr?.setNodeMarkup($from.before(itemDepth), null, { ...item.attrs, checked }) ?? null;
		}

		return wrapParagraph(state, from, to, state.schema.nodes.list, { ordered: false, start: null }, { checked, spread: false });
	},
};

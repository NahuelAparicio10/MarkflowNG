import type { Attrs, NodeType } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";

/**
 * Deletes the typed syntax at the start of a paragraph, the first step of every
 * block rule. Block syntax only converts in a paragraph, never in a heading.
 */
export function deleteParagraphPrefix(state: EditorState, from: number, to: number): Transaction | null {
	if (state.doc.resolve(from).parent.type !== state.schema.nodes.paragraph) {
		return null;
	}

	return state.tr.delete(from, to);
}

/**
 * Deletes the typed syntax and wraps the paragraph in `type`, adding any
 * wrappers its content expression requires in between — a list needs a list
 * item. `innerAttrs` sets the attributes of those inner wrappers.
 */
export function wrapParagraph(
	state: EditorState,
	from: number,
	to: number,
	type: NodeType,
	attrs: Attrs | null = null,
	innerAttrs: Attrs | null = null,
): Transaction | null {
	const tr = deleteParagraphPrefix(state, from, to);
	if (!tr) {
		return null;
	}

	const range = tr.doc.resolve(from).blockRange();
	const wrapping = range ? findWrapping(range, type, attrs) : null;
	if (!range || !wrapping) {
		return null;
	}

	const wrappers = wrapping.map((wrapper, index) => (index > 0 && innerAttrs ? { ...wrapper, attrs: innerAttrs } : wrapper));

	return tr.wrap(range, wrappers);
}

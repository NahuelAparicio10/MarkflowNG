import { liftListItem } from "@tiptap/pm/schema-list";
import { setBlockType, wrapIn } from "@tiptap/pm/commands";
import { TextSelection, type Command, type EditorState } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";

export type ListKind = "bullet" | "ordered" | "task";

export const insertHorizontalRule: Command = (state, dispatch) => {
	const { $from } = state.selection;
	if ($from.parent.type !== state.schema.nodes.paragraph) return false;
	const before = $from.before();
	const tr = state.tr.replaceWith(before, $from.after(), [
		state.schema.nodes.thematicBreak.create(),
		state.schema.nodes.paragraph.create(),
	]);
	dispatch?.(tr.setSelection(TextSelection.create(tr.doc, before + 2)));
	return true;
};

export function setTextBlock(kind: "paragraph" | "heading" | "codeBlock", attrs: Record<string, unknown> | null = null): Command {
	return (state, dispatch) => setBlockType(state.schema.nodes[kind], attrs)(state, dispatch);
}

export function wrapInBlock(kind: "blockquote"): Command {
	return (state, dispatch) => wrapIn(state.schema.nodes[kind])(state, dispatch);
}

function listAncestor(state: EditorState): { depth: number; pos: number } | null {
	for (let depth = state.selection.$from.depth; depth > 0; depth--) {
		if (state.selection.$from.node(depth).type === state.schema.nodes.list) {
			return { depth, pos: state.selection.$from.before(depth) };
		}
	}
	return null;
}

export function activeListKind(state: EditorState): ListKind | null {
	const ancestor = listAncestor(state);
	if (!ancestor) return null;
	const list = state.selection.$from.node(ancestor.depth);
	if (list.attrs.ordered) return "ordered";
	const item = state.selection.$from.node(ancestor.depth + 1);
	return typeof item?.attrs.checked === "boolean" ? "task" : "bullet";
}

export function toggleList(kind: ListKind): Command {
	return (state, dispatch) => {
		const ancestor = listAncestor(state);
		if (ancestor) {
			if (activeListKind(state) === kind) return liftListItem(state.schema.nodes.listItem)(state, dispatch);
			const ordered = kind === "ordered";
			let tr = state.tr.setNodeMarkup(ancestor.pos, undefined, { ordered, start: ordered ? 1 : null });
			if (kind === "task") {
				const itemDepth = ancestor.depth + 1;
				tr = tr.setNodeMarkup(state.selection.$from.before(itemDepth), undefined, { checked: false, spread: false });
			} else {
				const itemDepth = ancestor.depth + 1;
				tr = tr.setNodeMarkup(state.selection.$from.before(itemDepth), undefined, { checked: null, spread: false });
			}
			dispatch?.(tr);
			return true;
		}

		const attrs = kind === "ordered" ? { ordered: true, start: 1 } : { ordered: false, start: null };
		if (kind !== "task") return wrapIn(state.schema.nodes.list, attrs)(state, dispatch);
		const range = state.selection.$from.blockRange(state.selection.$to);
		const wrapping = range ? findWrapping(range, state.schema.nodes.list, attrs) : null;
		if (!range || !wrapping) return false;
		const wrappers = wrapping.map((wrapper, index) => index > 0 ? { ...wrapper, attrs: { checked: false, spread: false } } : wrapper);
		dispatch?.(state.tr.wrap(range, wrappers));
		return true;
	};
}

export function setCodeLanguage(language: string | null): Command {
	return (state, dispatch) => {
		for (let depth = state.selection.$from.depth; depth >= 0; depth--) {
			const node = state.selection.$from.node(depth);
			if (node.type === state.schema.nodes.codeBlock) {
				const pos = depth === 0 ? 0 : state.selection.$from.before(depth);
				dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: language || null }));
				return true;
			}
		}
		return false;
	};
}

/** Inserts the portable GitHub callout marker and wraps the paragraph as a quote. */
export const insertWarningCallout: Command = (state, dispatch) => {
	const { $from } = state.selection;
	if ($from.parent.type !== state.schema.nodes.paragraph) return false;
	const paragraphStart = $from.start();
	const tr = state.tr.insertText("[!WARNING] ", paragraphStart);
	const range = tr.doc.resolve(paragraphStart).blockRange();
	if (!range) return false;
	const wrappers = [{ type: state.schema.nodes.blockquote, attrs: null }];
	dispatch?.(tr.wrap(range, wrappers).scrollIntoView());
	return true;
};

export function activeBlock(state: EditorState): { kind: string; level?: number; language?: string | null } {
	const node = state.selection.$from.parent;
	return { kind: node.type.name, level: node.attrs.level as number | undefined, language: node.attrs.language as string | null | undefined };
}

import { getMarkRange } from "@tiptap/core";
import type { Command, EditorState } from "@tiptap/pm/state";

export interface ActiveLink {
	href: string;
	title: string | null;
	/** The whole linked span, which editing and removal act on. */
	from: number;
	to: number;
}

/**
 * The link the selection is in: the one around the caret, or the one that
 * wholly contains a non-empty selection. `null` when there is none.
 */
export function getActiveLink(state: EditorState): ActiveLink | null {
	const linkType = state.schema.marks.link;
	const { $from, from, to, empty } = state.selection;

	// At a boundary, `getMarkRange` looks at the node on either side, so a caret
	// just after the last linked character still finds the link.
	const range = getMarkRange($from, linkType);
	if (!range) {
		return null;
	}

	if (!empty && (from < range.from || to > range.to)) {
		return null;
	}

	// The text node starting the range carries the mark and its attributes.
	const mark = linkType.isInSet(state.doc.nodeAt(range.from)?.marks ?? []);
	if (!mark) {
		return null;
	}

	return {
		href: mark.attrs.href as string,
		title: mark.attrs.title as string | null,
		from: range.from,
		to: range.to,
	};
}

/**
 * Links the selection to `href`, or retargets the link the caret is in. With
 * an empty selection outside any link, inserts the URL itself as linked text,
 * since there is no other text to link.
 */
export function setLink(href: string): Command {
	return (state, dispatch) => {
		const target = href.trim();
		if (target === "") {
			return removeLink(state, dispatch);
		}

		const linkType = state.schema.marks.link;
		const { from, to, empty, $from } = state.selection;
		if (!$from.parent.type.allowsMarkType(linkType)) {
			return false;
		}

		const active = getActiveLink(state);
		const tr = state.tr;

		if (active) {
			tr.removeMark(active.from, active.to, linkType);
			tr.addMark(active.from, active.to, linkType.create({ href: target, title: active.title }));
		} else if (empty) {
			tr.insert(from, state.schema.text(target, [...$from.marks(), linkType.create({ href: target })]));
		} else {
			tr.removeMark(from, to, linkType);
			tr.addMark(from, to, linkType.create({ href: target }));
		}

		dispatch?.(tr.scrollIntoView());
		return true;
	};
}

/** Removes the link around the caret or across the selection, keeping its text. */
export const removeLink: Command = (state, dispatch) => {
	const linkType = state.schema.marks.link;
	const active = getActiveLink(state);
	const { from, to } = active ?? state.selection;

	if (!state.doc.rangeHasMark(from, to, linkType)) {
		return false;
	}

	dispatch?.(state.tr.removeMark(from, to, linkType));
	return true;
};

const URL_PATTERN = /^(?:https?:\/\/|mailto:)\S+$/i;

/** Whether pasted text is a single URL, rather than prose that contains one. */
export function isUrl(text: string): boolean {
	return URL_PATTERN.test(text.trim());
}

/**
 * Pasting a URL over selected text links the text instead of replacing it —
 * see design decision D5. Declines, so the paste proceeds normally, when
 * nothing is selected or the clipboard holds anything but a single URL.
 */
export function linkSelectionWithUrl(text: string): Command {
	return (state, dispatch) => {
		if (state.selection.empty || !isUrl(text)) {
			return false;
		}

		return setLink(text)(state, dispatch);
	};
}

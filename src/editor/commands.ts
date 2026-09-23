import { toggleMark } from "@tiptap/pm/commands";
import { liftListItem, sinkListItem, splitListItem } from "@tiptap/pm/schema-list";
import type { Command, EditorState } from "@tiptap/pm/state";

/**
 * Editor commands in plain ProseMirror form, so they can be exercised against
 * an `EditorState` without a DOM-backed view. The shortcut table binds them.
 */

/**
 * Toggles a mark over the selection, or as a stored mark for the next typed
 * text when the selection is empty.
 *
 * Over a selection that only partly carries the mark, the mark is added rather
 * than removed, matching word processors: pressing bold on a half-bold phrase
 * makes all of it bold, and pressing again removes it.
 */
export function toggleMarkCommand(markName: string): Command {
	return (state, dispatch) => {
		const markType = state.schema.marks[markName];

		return toggleMark(markType, null, { removeWhenPresent: false })(state, dispatch);
	};
}

/** Depth of the innermost list item around the selection, or -1. */
function listItemDepth(state: EditorState): number {
	const { $from } = state.selection;
	const itemType = state.schema.nodes.listItem;

	for (let depth = $from.depth; depth > 0; depth--) {
		if ($from.node(depth).type === itemType) {
			return depth;
		}
	}

	return -1;
}

/**
 * Enter inside a list: continues the list from a non-empty item, and leaves it
 * from an empty one.
 *
 * Leaving is one level at a time: an empty item in a nested list moves out to
 * the parent list, and an empty top-level item becomes a paragraph after the
 * list. A new item after a task item is an unchecked task item.
 */
export const enterInList: Command = (state, dispatch) => {
	const { $from } = state.selection;
	const depth = listItemDepth(state);

	// Enter inside a code block in a list item is a newline, not a new item.
	if (depth < 0 || $from.parent.type.spec.code) {
		return false;
	}

	const itemType = state.schema.nodes.listItem;
	const item = $from.node(depth);
	const newItemAttrs = {
		checked: typeof item.attrs.checked === "boolean" ? false : null,
		spread: item.attrs.spread as boolean,
	};

	if (splitListItem(itemType, newItemAttrs)(state, dispatch)) {
		return true;
	}

	// splitListItem declines an empty top-level item, leaving it to be lifted.
	if ($from.parent.content.size === 0) {
		return liftListItem(itemType)(state, dispatch);
	}

	return false;
};

/** Nests the current item under the previous one. */
export const indentListItem: Command = (state, dispatch) => {
	if (listItemDepth(state) < 0) {
		return false;
	}

	// Handled even when the item cannot sink (it is the first in its list), so
	// Tab never moves focus out of the editor from inside a list.
	sinkListItem(state.schema.nodes.listItem)(state, dispatch);
	return true;
};

/** Moves the current item out one level, or out of the list at the top level. */
export const outdentListItem: Command = (state, dispatch) => {
	if (listItemDepth(state) < 0) {
		return false;
	}

	return liftListItem(state.schema.nodes.listItem)(state, dispatch);
};

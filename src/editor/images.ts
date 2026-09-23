import type { Node as PmNode } from "@tiptap/pm/model";
import { type Command, type EditorState, NodeSelection, type Transaction } from "@tiptap/pm/state";

/**
 * Image commands in plain ProseMirror form, like `commands.ts`.
 *
 * Insertion takes an already-decided reference: choosing between a relative
 * path, a path as given and a URL is `referenceFor` in `src/images/paths.ts`,
 * and writing pasted data is `writeImageAsset` — neither belongs in a command.
 */

export interface ImageAttrs {
	src: string;
	alt?: string;
}

/** The smallest width a resize can set, so an image cannot be dragged to nothing. */
export const MIN_IMAGE_WIDTH = 16;

/**
 * Inserts images at `pos`, or at the selection when `pos` is omitted. Inside
 * a code block, whose content is literal text, they go into a new paragraph
 * after it instead.
 */
export function insertImages(images: ImageAttrs[], pos?: number): Command {
	return (state, dispatch) => {
		if (images.length === 0) {
			return false;
		}

		const imageType = state.schema.nodes.image;
		const nodes = images.map((image) => imageType.create({ src: image.src, alt: image.alt ?? "" }));
		const tr = state.tr;
		const $pos = pos === undefined ? state.selection.$from : state.doc.resolve(pos);

		if ($pos.parent.type.spec.code) {
			const after = $pos.after();
			tr.insert(after, state.schema.nodes.paragraph.create(null, nodes));
		} else if (pos === undefined) {
			tr.replaceSelectionWith(nodes[0], false);
			for (const node of nodes.slice(1)) {
				tr.insert(tr.selection.to, node);
			}
		} else {
			tr.insert(pos, nodes);
		}

		dispatch?.(tr.scrollIntoView());
		return true;
	};
}

/** The selected image and its position, or `null` when no image is selected. */
export function selectedImage(state: EditorState): { node: PmNode; pos: number } | null {
	const { selection } = state;

	if (selection instanceof NodeSelection && selection.node.type.name === "image") {
		return { node: selection.node, pos: selection.from };
	}

	return null;
}

function updateImageAt(pos: number, attrs: Record<string, unknown>, tr: Transaction): Transaction {
	const node = tr.doc.nodeAt(pos);
	if (!node || node.type.name !== "image") {
		return tr;
	}

	tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs });
	// Keep the image selected, so its controls stay open after the change.
	return tr.setSelection(NodeSelection.create(tr.doc, pos));
}

export function setImageAlt(pos: number, alt: string): Command {
	return (state, dispatch) => {
		dispatch?.(updateImageAt(pos, { alt }, state.tr));
		return true;
	};
}

/**
 * Sets the display width, or clears it with `null`. Clearing removes the
 * encoded size from the title again, so an image restored to its natural
 * size is written back exactly as if it had never been resized.
 */
export function setImageWidth(pos: number, width: number | null): Command {
	return (state, dispatch) => {
		const value = width === null ? null : Math.max(MIN_IMAGE_WIDTH, Math.round(width));
		dispatch?.(updateImageAt(pos, { width: value }, state.tr));
		return true;
	};
}

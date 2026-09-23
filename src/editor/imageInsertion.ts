import { open } from "@tauri-apps/plugin-dialog";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { hasImageExtension, IMAGE_EXTENSIONS, writeImageAsset } from "../images/assets";
import { referenceFor } from "../images/paths";
import { type ImageAttrs, insertImages } from "./images";

/**
 * Where the editor's image insertion gets what it cannot know by itself: the
 * document it is editing, the workspace it belongs to, and how to tell the
 * user something happened. Read at the moment of insertion, never captured.
 */
export interface ImageInsertionContext {
	getDocumentPath(): string | null;
	getWorkspaceRoot(): string | null;
	/** Reports where pasted data was written, or why it could not be. */
	notify(message: string, kind: "info" | "error"): void;
}

function imageFilesOf(data: DataTransfer | null): File[] {
	if (!data) {
		return [];
	}

	return [...data.files].filter((file) => file.type.startsWith("image/") || hasImageExtension(file.name));
}

/** Base name without extension, as a starting alt text for a named file. */
function altFromName(name: string): string {
	const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
	return base.replace(/\.[^.]+$/, "");
}

/**
 * Writes image data that has no file of its own — a screenshot on the
 * clipboard, an image dragged from a browser — into the assets directory
 * beside the document (design decision D6), and inserts references to it.
 * Never embeds the data in the document.
 */
async function insertImageData(view: EditorView, files: File[], pos: number | undefined, context: ImageInsertionContext) {
	const documentPath = context.getDocumentPath();
	if (documentPath === null) {
		context.notify("Save the document before adding images to it.", "error");
		return;
	}

	const inserted: ImageAttrs[] = [];
	const written: string[] = [];

	for (const file of files) {
		try {
			const data = new Uint8Array(await file.arrayBuffer());
			const asset = await writeImageAsset(documentPath, data, file.type, file.name || undefined);
			inserted.push({ src: asset.reference, alt: file.name ? altFromName(file.name) : "" });
			written.push(asset.path);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			context.notify(`Could not save the image beside the document: ${message}`, "error");
		}
	}

	if (inserted.length === 0 || view.isDestroyed) {
		return;
	}

	// The document may have changed while the files were written; a drop
	// position is clamped rather than mapped, which is exact in the common
	// case where nothing else was typed in the meantime.
	const target = pos === undefined ? undefined : Math.min(pos, view.state.doc.content.size);
	insertImages(inserted, target)(view.state, view.dispatch);

	const where = written.length === 1 ? written[0] : `${written.length} files in ${written[0].replace(/[/\\][^/\\]*$/, "")}`;
	context.notify(`Image saved to ${where}`, "info");
}

/**
 * References to image files that already exist on disk. Each is stored
 * relative to the document when it lies inside the workspace, and as given
 * otherwise (design decision D5).
 */
function imagesForFiles(paths: string[], context: ImageInsertionContext): ImageAttrs[] {
	const documentPath = context.getDocumentPath();

	return paths.filter(hasImageExtension).map((path) => ({
		src: documentPath === null ? path : referenceFor(documentPath, path, context.getWorkspaceRoot()),
		alt: altFromName(path),
	}));
}

/**
 * Inserts references to image files that already exist on disk — dropped from
 * the file manager, or chosen in the file dialog.
 */
export function insertImageFiles(
	view: EditorView,
	paths: string[],
	pos: number | undefined,
	context: ImageInsertionContext,
): boolean {
	return insertImages(imagesForFiles(paths, context), pos)(view.state, view.dispatch);
}

/**
 * Asks for an image file in the file dialog, for the slash menu's image entry.
 * Resolves to no images when the dialog is cancelled or cannot open.
 */
export async function chooseImageFiles(context: ImageInsertionContext): Promise<ImageAttrs[]> {
	try {
		const selected = await open({ multiple: false, filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }] });

		return typeof selected === "string" ? imagesForFiles([selected], context) : [];
	} catch (error) {
		context.notify(`Could not open the file dialog: ${error instanceof Error ? error.message : String(error)}`, "error");
		return [];
	}
}

/** Paste and HTML5 drop of image data. OS file drops arrive through Tauri instead. */
export function createImageInsertionPlugin(context: ImageInsertionContext): Plugin {
	return new Plugin({
		key: new PluginKey("markflowImageInsertion"),
		props: {
			handlePaste(view, event) {
				const files = imageFilesOf(event.clipboardData);
				if (files.length === 0) {
					return false;
				}

				event.preventDefault();
				void insertImageData(view, files, undefined, context);
				return true;
			},

			handleDrop(view, event) {
				const files = imageFilesOf(event.dataTransfer);
				if (files.length === 0) {
					return false;
				}

				event.preventDefault();
				const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
				void insertImageData(view, files, pos, context);
				return true;
			},
		},
	});
}

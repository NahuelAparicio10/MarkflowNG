import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { hasImageExtension } from "../images/assets";
import { type ImageInsertionContext, insertImageFiles } from "./imageInsertion";

/**
 * Inserts image files dropped from the operating system onto the visible
 * editor, at the drop position.
 *
 * Tauri intercepts OS file drops before the webview sees them, so they never
 * reach ProseMirror's `handleDrop`; they arrive here instead, with real file
 * paths, which are referenced directly rather than copied (design decision
 * D5). Data dropped from inside the page, such as an image dragged out of a
 * browser, has no path and is handled by `createImageInsertionPlugin`.
 */
export function useOsImageDrop(editor: Editor | null, isVisible: boolean, context: ImageInsertionContext): void {
	useEffect(() => {
		if (!editor || !isVisible || !isTauri()) {
			return;
		}

		let unlisten: (() => void) | null = null;
		let disposed = false;

		void getCurrentWebview()
			.onDragDropEvent((event) => {
				if (event.payload.type !== "drop" || editor.isDestroyed) {
					return;
				}

				const paths = event.payload.paths.filter(hasImageExtension);
				if (paths.length === 0) {
					return;
				}

				// Tauri reports physical pixels; the DOM works in CSS pixels.
				const ratio = window.devicePixelRatio || 1;
				const coords = { left: event.payload.position.x / ratio, top: event.payload.position.y / ratio };
				const bounds = editor.view.dom.getBoundingClientRect();
				const insideEditor =
					coords.left >= bounds.left &&
					coords.left <= bounds.right &&
					coords.top >= bounds.top &&
					coords.top <= bounds.bottom;
				if (!insideEditor) {
					return;
				}

				const pos = editor.view.posAtCoords(coords)?.pos;
				insertImageFiles(editor.view, paths, pos, context);
			})
			.then((stop) => {
				if (disposed) {
					stop();
				} else {
					unlisten = stop;
				}
			});

		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [editor, isVisible, context]);
}

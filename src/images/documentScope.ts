import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Asks the backend to let the app read and write beside `documentPath`, so
 * the images a lone document references resolve and pasted images can be
 * written into its assets directory. See `src-tauri/src/document_scope.rs`.
 *
 * Best effort: when refused, the document still opens, and its local images
 * show as missing rather than failing the open. Outside Tauri — the dev
 * server Playwright drives — there is no scope to extend.
 */
export async function allowDocumentDirectory(documentPath: string): Promise<void> {
	if (!isTauri()) {
		return;
	}

	try {
		await invoke("allow_document_directory", { path: documentPath });
	} catch {
		// Images beside the document will show as missing; nothing else depends on it.
	}
}

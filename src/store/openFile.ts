import { open } from "@tauri-apps/plugin-dialog";
import { parseMarkdown } from "../core/markdown";
import { readTextFile } from "../editor/fs";
import { recordLoadedContent } from "../explorer/selfWrites";
import { allowDocumentDirectory } from "../images/documentScope";
import { selectDocument, useSessionStore } from "./session";
import { markStartup } from "../startupTiming";

/**
 * Opens the native file dialog and loads the chosen `.md` file into the
 * session store in reader mode. Cancelling the dialog leaves the currently
 * open document, if any, untouched.
 */
export async function openFileDialog(): Promise<void> {
	const selected = await open({
		multiple: false,
		filters: [{ name: "Markdown", extensions: ["md"] }],
	});

	if (!selected || Array.isArray(selected)) {
		return;
	}

	await openFileAtPath(selected);
}

/**
 * Reads and parses a file already known by path — used by the dialog above,
 * the OS file-association startup path and the workspace explorer — and opens
 * it as a tab. A file that is already open is only activated, never re-read,
 * so its editor keeps its unsaved edits and undo history. Reports a failure
 * through the session store's `error` field rather than throwing, so the app
 * stays usable.
 */
export async function openFileAtPath(path: string): Promise<void> {
	const session = useSessionStore.getState();
	if (selectDocument(session, path)) {
		session.activateDocument(path);
		return;
	}

	try {
		const source = await readTextFile(path);
		recordLoadedContent(path, source);
		// Before the document renders, so its images resolve on first paint.
		await allowDocumentDirectory(path);
		const tree = parseMarkdown(source);
		markStartup("startup-document-parsed");
		useSessionStore.getState().openDocument(path, tree);
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => markStartup("startup-document-visible"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		useSessionStore.getState().setError(`Could not open "${path}": ${message}`);
	}
}

import { parseMarkdown } from "../core/markdown";
import { getEditor } from "../editor/editorRegistry";
import { saveMarkdownTree } from "../editor/saveDocument";
import { exists, readTextFile } from "../editor/fs";
import { selectDocument, useSessionStore } from "../store/session";
import { isSameOrInside, toWorkspaceRelative } from "./paths";
import { forgetKnownContent, isKnownContent, recordLoadedContent } from "./selfWrites";
import type { WatchChange } from "./types";

/**
 * What happened to an open document because of a genuine external change.
 * The application's own writes never produce one of these.
 */
export type ExternalChange =
	| { path: string; outcome: "reloaded" }
	| { path: string; outcome: "conflict" }
	| { path: string; outcome: "deleted" };

/**
 * Reacts to a watcher batch on behalf of the open documents — design decision
 * D6. For each open document the batch touched:
 *
 * - content that matches what the application last wrote or read is its own
 *   doing and is ignored (D5);
 * - otherwise a clean document is reloaded silently, and a dirty one is put
 *   in conflict for the user to answer, with nothing written or discarded;
 * - a deleted document is kept open with its in-memory content, and the user
 *   is told.
 *
 * Resolves with the genuine external changes it acted on.
 */
export async function applyExternalChanges(root: string, changes: WatchChange[]): Promise<ExternalChange[]> {
	const results: ExternalChange[] = [];
	const touched = affectedOpenDocuments(root, changes);

	for (const [path, possiblyDeleted] of touched) {
		const result = possiblyDeleted ? await checkDeleted(path) : await checkContent(path);
		if (result) {
			results.push(result);
		}
	}

	return results;
}

/**
 * Open documents a batch refers to, each mapped to whether the batch says it
 * may be gone. A removed folder takes every open document inside it along.
 */
function affectedOpenDocuments(root: string, changes: WatchChange[]): Map<string, boolean> {
	const openPaths = useSessionStore.getState().documents.map((document) => document.path);
	const openByRelative = new Map<string, string>();
	for (const path of openPaths) {
		const relative = toWorkspaceRelative(root, path);
		if (relative !== null) {
			openByRelative.set(relative, path);
		}
	}

	const touched = new Map<string, boolean>();
	const markContent = (relative: string) => {
		const path = openByRelative.get(relative);
		if (path !== undefined) {
			touched.set(path, false);
		}
	};
	const markRemoved = (relative: string) => {
		for (const [openRelative, path] of openByRelative) {
			if (isSameOrInside(openRelative, relative)) {
				touched.set(path, true);
			}
		}
	};

	for (const change of changes) {
		switch (change.kind) {
			case "created":
			case "modified":
				markContent(change.entry.path);
				break;
			case "removed":
				markRemoved(change.path);
				break;
			case "renamed":
				markRemoved(change.from);
				markContent(change.entry.path);
				break;
		}
	}

	return touched;
}

async function checkDeleted(path: string): Promise<ExternalChange | null> {
	// A replace-by-rename can surface as a removal; the disk decides.
	if (await exists(path)) {
		return checkContent(path);
	}

	return markDeleted(path);
}

function markDeleted(path: string): ExternalChange | null {
	const session = useSessionStore.getState();
	const document = selectDocument(session, path);
	if (!document || document.conflict?.kind === "deleted") {
		return null;
	}

	session.setConflict(path, { kind: "deleted" });
	return { path, outcome: "deleted" };
}

async function checkContent(path: string): Promise<ExternalChange | null> {
	let text: string;
	try {
		text = await readTextFile(path);
	} catch {
		return (await exists(path)) ? null : markDeleted(path);
	}

	const session = useSessionStore.getState();
	const document = selectDocument(session, path);
	if (!document) {
		return null;
	}

	if (isKnownContent(path, text)) {
		// The application's own write, or bytes it already has. If the file
		// had been reported deleted, it is back exactly as it was.
		if (document.conflict?.kind === "deleted") {
			session.setConflict(path, null);
		}
		return null;
	}

	// Read the dirty flag after the await above, not before: an edit typed
	// while the file was being read must not be reloaded away.
	if (document.dirty) {
		session.setConflict(path, { kind: "modified" });
		return { path, outcome: "conflict" };
	}

	recordLoadedContent(path, text);
	session.reloadDocument(path, parseMarkdown(text));
	return { path, outcome: "reloaded" };
}

/**
 * The user's answer to a conflict shown for an open document. `keep-local`
 * answers both kinds: for a modified file it overwrites the disk version, for
 * a deleted one it writes the file again.
 */
export type ConflictResolution = "keep-local" | "reload-from-disk" | "close";

/**
 * Carries out the user's answer. Only here — never automatically — is the
 * disk overwritten with the local version (`keep-local`) or the local version
 * discarded (`reload-from-disk`, `close`).
 */
export async function resolveConflict(path: string, resolution: ConflictResolution): Promise<void> {
	const session = useSessionStore.getState();
	if (!selectDocument(session, path)) {
		return;
	}

	switch (resolution) {
		case "keep-local": {
			const document = selectDocument(session, path);
			session.setConflict(path, null);
			// Forced: the user chose the local version, so the disk gets it
			// even if it matches what was last loaded — e.g. unedited content
			// of a file that was deleted.
			const editor = getEditor(path);
			if (editor) await editor.saveNow({ force: true });
			else if (document) await saveMarkdownTree(path, document.tree);
			break;
		}
		case "reload-from-disk": {
			try {
				const text = await readTextFile(path);
				recordLoadedContent(path, text);
				session.reloadDocument(path, parseMarkdown(text));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				session.setError(`Could not reload "${path}": ${message}`);
			}
			break;
		}
		case "close": {
			session.closeDocument(path);
			forgetKnownContent(path);
			break;
		}
	}
}

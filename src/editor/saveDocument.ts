import type { Node as PmNode } from "@tiptap/pm/model";
import { recordSelfWrite } from "../explorer/selfWrites";
import { serializeDoc } from "./documentText";
import { remove, rename, writeTextFile } from "./fs";

/** Where the atomic write's temporary file lands, next to the real one. */
function tempPathFor(path: string): string {
	return `${path}.markflow-tmp`;
}

/**
 * Saves `doc` to `path`: maps it to mdast and serializes it through the
 * core, then writes the result atomically — to a temporary file in the
 * same directory, then a rename over the target. See design decision D3.
 *
 * Serialization happens before any write, so if it throws, nothing has
 * been written — see the "Serialization failure does not write" scenario.
 * There is no branch that bypasses serialization: the returned text is
 * always what `serializeDoc` produced from `doc`.
 *
 * The path and content are recorded as a self-write *before* anything is
 * written, so the workspace watcher's report of this very write is
 * recognised as the application's own rather than raised as an external
 * change (design decision D5 of the workspace-explorer change). The watcher
 * itself is never paused or unsubscribed here.
 */
export async function saveDocument(path: string, doc: PmNode): Promise<string> {
	const text = serializeDoc(doc);
	const tempPath = tempPathFor(path);
	recordSelfWrite(path, text);

	try {
		await writeTextFile(tempPath, text);
		await rename(tempPath, path);
	} catch (error) {
		await remove(tempPath);
		throw error;
	}

	return text;
}

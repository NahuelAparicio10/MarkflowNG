/**
 * What code outside an open document's `EditorView` may ask of it. Saving
 * belongs to the view — it alone holds the ProseMirror document and the
 * baseline it compares against — but answering an external-change conflict
 * (`src/explorer/externalChanges.ts`) has to be able to trigger one.
 */
export interface EditorHandle {
	/** Current unsaved Markdown, without writing it to disk. */
	getMarkdown?(): string;
	/**
	 * Saves now. `force` writes even when the content matches what was last
	 * loaded or saved — needed to re-create a file deleted on disk.
	 */
	saveNow(options?: { force?: boolean }): Promise<void>;
}

const handles = new Map<string, EditorHandle>();

export function registerEditor(path: string, handle: EditorHandle): void {
	handles.set(path, handle);
}

export function unregisterEditor(path: string, handle: EditorHandle): void {
	// Only remove the entry this caller registered: a remounted view may
	// already have replaced it.
	if (handles.get(path) === handle) {
		handles.delete(path);
	}
}

export function getEditor(path: string): EditorHandle | null {
	return handles.get(path) ?? null;
}

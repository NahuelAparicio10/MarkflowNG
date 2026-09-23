/**
 * The shapes the Rust side sends — `src-tauri/src/workspace.rs` and
 * `src-tauri/src/watcher.rs`. Every `path` here is relative to the workspace
 * root and uses `/`, whatever the platform.
 */

export type EntryKind = "file" | "directory";

export interface WorkspaceEntry {
	path: string;
	kind: EntryKind;
	/** Only Markdown files are openable; the rest are listed greyed out. */
	markdown: boolean;
}

export interface ScanFailure {
	path: string;
	message: string;
}

export interface ScanSummary {
	entryCount: number;
	failures: ScanFailure[];
	cancelled: boolean;
}

/**
 * One change on disk. `created` and `modified` carry the entry as it was when
 * the batch was emitted; a rename the platform did not report atomically
 * arrives as `removed` plus `created` instead of `renamed`.
 */
export type WatchChange =
	| { kind: "created"; entry: WorkspaceEntry }
	| { kind: "modified"; entry: WorkspaceEntry }
	| { kind: "removed"; path: string }
	| { kind: "renamed"; from: string; entry: WorkspaceEntry };

/** Every change the watcher coalesced from one burst of activity. */
export interface WatchBatch {
	changes: WatchChange[];
}

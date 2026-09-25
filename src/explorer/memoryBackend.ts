import type { WorkspaceBackend } from "./backend";
import { parentPath } from "./paths";
import type { WatchBatch, WorkspaceEntry } from "./types";

export interface MemoryWorkspaceBackend extends WorkspaceBackend {
	/** Delivers `batch` to the current watch subscriber, as the Rust watcher would. */
	emit(batch: WatchBatch): void;
	/** How many times `scan` was called — a rescan is a test failure where increments are expected. */
	scanCount(): number;
}

/**
 * An in-memory stand-in for the Rust scan and watcher, for unit tests and the
 * dev/e2e hatch — neither runs inside Tauri. `files` are root-relative,
 * `/`-separated paths; folders are inferred from them, and Markdown-ness
 * follows the same extensions as `src-tauri/src/workspace.rs`.
 *
 * `failWith`, when given, makes `scan` and `watch` reject, standing in for an
 * unreadable folder.
 */
export function createMemoryWorkspaceBackend(files: readonly string[], failWith?: string): MemoryWorkspaceBackend {
	let subscriber: ((batch: WatchBatch) => void) | null = null;
	let scans = 0;

	return {
		async scan(_root, onChunk) {
			scans++;
			if (failWith) {
				throw new Error(failWith);
			}

			const entries = listEntries(files);
			onChunk(entries);
			return { entryCount: entries.length, failures: [], cancelled: false };
		},

		async watch(_root, onBatch) {
			if (failWith) {
				throw new Error(failWith);
			}
			subscriber = onBatch;
		},

		async unwatch() {
			subscriber = null;
		},

		emit(batch) {
			subscriber?.(batch);
		},

		scanCount() {
			return scans;
		},
	};
}

export function isMarkdownPath(path: string): boolean {
	return /\.(md|markdown)$/i.test(path);
}

export function fileEntry(path: string): WorkspaceEntry {
	return { path, kind: "file", markdown: isMarkdownPath(path) };
}

function listEntries(files: readonly string[]): WorkspaceEntry[] {
	const entries = new Map<string, WorkspaceEntry>();

	for (const file of files) {
		entries.set(file, fileEntry(file));
		for (let folder = parentPath(file); folder !== ""; folder = parentPath(folder)) {
			entries.set(folder, { path: folder, kind: "directory", markdown: false });
		}
	}

	return [...entries.values()];
}

import { create } from "zustand";
import { isSameOrInside, parentPath } from "../explorer/paths";
import type { ScanFailure, ScanSummary, WatchChange, WorkspaceEntry } from "../explorer/types";

/**
 * The open workspace: its root and the file listing, cached in memory once
 * per scan and kept current from watcher events rather than by rescanning.
 * The tree and quick open both read this listing (design decision D3), so
 * nothing in either crosses the bridge per keystroke or per row.
 *
 * Peripheral state only, like the session store: which folder, which rows are
 * expanded, what is selected. No document content lives here.
 */
export interface WorkspaceState {
	root: string | null;
	/** Every listed entry, keyed by its root-relative path. */
	entries: ReadonlyMap<string, WorkspaceEntry>;
	scanning: boolean;
	scanFailures: ScanFailure[];
	/** Root-relative paths of expanded folders. */
	expanded: ReadonlySet<string>;
	/** The tree's keyboard/mouse selection. */
	selectedPath: string | null;
	/** The Markdown file shown in preview, if any. */
	previewPath: string | null;

	/** Starts a new workspace at `root`, discarding the previous one. */
	beginWorkspace(root: string): void;
	addEntries(entries: WorkspaceEntry[]): void;
	finishScan(summary: ScanSummary): void;
	/** Applies one watcher batch to the listing, incrementally. */
	applyChanges(changes: WatchChange[]): void;
	setExpanded(path: string, expanded: boolean): void;
	select(path: string | null): void;
	setPreview(path: string | null): void;
	closeWorkspace(): void;
}

const EMPTY_ENTRIES: ReadonlyMap<string, WorkspaceEntry> = new Map();
const EMPTY_EXPANDED: ReadonlySet<string> = new Set();

const INITIAL_STATE = {
	root: null,
	entries: EMPTY_ENTRIES,
	scanning: false,
	scanFailures: [],
	expanded: EMPTY_EXPANDED,
	selectedPath: null,
	previewPath: null,
} satisfies Partial<WorkspaceState>;

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
	...INITIAL_STATE,

	beginWorkspace(root) {
		set({ ...INITIAL_STATE, root, scanning: true });
	},

	addEntries(entries) {
		set((state) => {
			const next = new Map(state.entries);
			for (const entry of entries) {
				next.set(entry.path, entry);
			}
			return { entries: next };
		});
	},

	finishScan(summary) {
		set({ scanning: false, scanFailures: summary.failures });
	},

	applyChanges(changes) {
		set((state) => {
			const entries = new Map(state.entries);
			const removed: string[] = [];

			for (const change of changes) {
				switch (change.kind) {
					case "created":
					case "modified":
						upsert(entries, change.entry);
						break;
					case "removed":
						removeWithDescendants(entries, change.path);
						removed.push(change.path);
						break;
					case "renamed":
						removeWithDescendants(entries, change.from);
						removed.push(change.from);
						upsert(entries, change.entry);
						break;
				}
			}

			const isGone = (path: string | null) =>
				path !== null && removed.some((removedPath) => isSameOrInside(path, removedPath));

			return {
				entries,
				expanded: removed.length > 0 ? withoutRemoved(state.expanded, removed) : state.expanded,
				selectedPath: isGone(state.selectedPath) ? null : state.selectedPath,
				previewPath: isGone(state.previewPath) ? null : state.previewPath,
			};
		});
	},

	setExpanded(path, expanded) {
		set((state) => {
			if (state.expanded.has(path) === expanded) {
				return state;
			}
			const next = new Set(state.expanded);
			if (expanded) {
				next.add(path);
			} else {
				next.delete(path);
			}
			return { expanded: next };
		});
	},

	select(path) {
		set({ selectedPath: path });
	},

	setPreview(path) {
		set({ previewPath: path });
	},

	closeWorkspace() {
		set(INITIAL_STATE);
	},
}));

/**
 * Adds or replaces an entry, and makes sure its parent folders are listed
 * too: a watcher batch may report a file inside a folder it did not report
 * separately.
 */
function upsert(entries: Map<string, WorkspaceEntry>, entry: WorkspaceEntry): void {
	entries.set(entry.path, entry);

	for (let parent = parentPath(entry.path); parent !== ""; parent = parentPath(parent)) {
		if (entries.has(parent)) {
			break;
		}
		entries.set(parent, { path: parent, kind: "directory", markdown: false });
	}
}

function removeWithDescendants(entries: Map<string, WorkspaceEntry>, path: string): void {
	const entry = entries.get(path);
	entries.delete(path);

	if (entry && entry.kind !== "directory") {
		return;
	}

	for (const key of [...entries.keys()]) {
		if (isSameOrInside(key, path)) {
			entries.delete(key);
		}
	}
}

function withoutRemoved(expanded: ReadonlySet<string>, removed: string[]): ReadonlySet<string> {
	const next = new Set<string>();
	for (const path of expanded) {
		if (!removed.some((removedPath) => isSameOrInside(path, removedPath))) {
			next.add(path);
		}
	}
	return next;
}

const markdownFilesCache = new WeakMap<ReadonlyMap<string, WorkspaceEntry>, string[]>();

/**
 * Root-relative paths of every Markdown file, sorted — the listing quick open
 * searches. Derived once per listing change and cached against the entries
 * map, so opening quick open repeatedly does not rebuild it.
 */
export function selectMarkdownFiles(state: Pick<WorkspaceState, "entries">): string[] {
	const cached = markdownFilesCache.get(state.entries);
	if (cached) {
		return cached;
	}

	const files: string[] = [];
	for (const entry of state.entries.values()) {
		if (entry.kind === "file" && entry.markdown) {
			files.push(entry.path);
		}
	}
	files.sort();

	markdownFilesCache.set(state.entries, files);
	return files;
}

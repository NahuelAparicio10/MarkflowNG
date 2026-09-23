import type { Root } from "mdast";
import { create } from "zustand";
import { deriveOutline, EMPTY_OUTLINE, type Outline } from "../reader/outline";

/**
 * The active view as a single value, not independent booleans: a combination
 * like `isEditing && isRawView` would be meaningless, and this makes it
 * unrepresentable instead of merely discouraged.
 */
export type ViewMode = "reader" | "raw" | "editor";

/**
 * Peripheral, read-only-document state: the open file, its parsed tree (used
 * by the reader and raw view, and to hydrate the editor on open), the active
 * mode, the derived outline and the dirty flag.
 *
 * While a document is open for editing, ProseMirror is the sole owner of its
 * *editable* content — this slice never holds a second, synced copy of it.
 * `tree` is a read-only snapshot with no caret to desynchronize, taken at
 * open time; it is not updated from editor transactions. See design
 * decision D4 of the document-editor-base change.
 */
export interface SessionState {
	filePath: string | null;
	fileName: string | null;
	tree: Root | null;
	mode: ViewMode;
	outline: Outline;
	error: string | null;
	dirty: boolean;

	openDocument(filePath: string, tree: Root): void;
	setMode(mode: ViewMode): void;
	/** Cycles reader → raw → editor → reader. */
	cycleMode(): void;
	setError(message: string | null): void;
	setDirty(dirty: boolean): void;
	closeDocument(): void;
}

const REACHABLE_MODE_CYCLE: readonly ViewMode[] = ["reader", "raw", "editor"];

export const useSessionStore = create<SessionState>()((set, get) => ({
	filePath: null,
	fileName: null,
	tree: null,
	mode: "reader",
	outline: EMPTY_OUTLINE,
	error: null,
	dirty: false,

	openDocument(filePath, tree) {
		set({
			filePath,
			fileName: basename(filePath),
			tree,
			mode: "reader",
			outline: deriveOutline(tree),
			error: null,
			dirty: false,
		});
	},

	setMode(mode) {
		set({ mode });
	},

	cycleMode() {
		const currentIndex = REACHABLE_MODE_CYCLE.indexOf(get().mode);
		const nextIndex = (currentIndex + 1) % REACHABLE_MODE_CYCLE.length;
		set({ mode: REACHABLE_MODE_CYCLE[nextIndex] });
	},

	setError(message) {
		set({ error: message });
	},

	setDirty(dirty) {
		set({ dirty });
	},

	closeDocument() {
		set({
			filePath: null,
			fileName: null,
			tree: null,
			mode: "reader",
			outline: EMPTY_OUTLINE,
			error: null,
			dirty: false,
		});
	},
}));

function basename(path: string): string {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments[segments.length - 1] || path;
}

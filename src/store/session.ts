import type { Root } from "mdast";
import { create } from "zustand";
import { deriveOutline, EMPTY_OUTLINE, type Outline } from "../reader/outline";

/**
 * The active view as a single value, not independent booleans: a combination
 * like `isEditing && isRawView` would be meaningless, and this makes it
 * unrepresentable instead of merely discouraged. `editor` is declared now so
 * phase 2 adds a case rather than reshaping this state; it is not reachable
 * yet, see `cycleMode`.
 */
export type ViewMode = "reader" | "raw" | "editor";

/**
 * Peripheral, read-only-document state for the current phase: the open file,
 * its parsed tree, the active mode and the derived outline.
 *
 * Once the editor lands, ownership of the *editable* document moves to
 * ProseMirror and this slice keeps only the file path, the dirty flag and the
 * mode — see design decision D5 of the markdown-reader change. A read-only
 * tree has no caret to desynchronize, so holding it here until then is not a
 * violation of that rule.
 */
export interface SessionState {
	filePath: string | null;
	fileName: string | null;
	tree: Root | null;
	mode: ViewMode;
	outline: Outline;
	error: string | null;

	openDocument(filePath: string, tree: Root): void;
	setMode(mode: ViewMode): void;
	/** Cycles reader ⇄ raw. Skips `editor`, which is not reachable yet. */
	cycleMode(): void;
	setError(message: string | null): void;
	closeDocument(): void;
}

const REACHABLE_MODE_CYCLE: readonly ViewMode[] = ["reader", "raw"];

export const useSessionStore = create<SessionState>()((set, get) => ({
	filePath: null,
	fileName: null,
	tree: null,
	mode: "reader",
	outline: EMPTY_OUTLINE,
	error: null,

	openDocument(filePath, tree) {
		set({
			filePath,
			fileName: basename(filePath),
			tree,
			mode: "reader",
			outline: deriveOutline(tree),
			error: null,
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

	closeDocument() {
		set({
			filePath: null,
			fileName: null,
			tree: null,
			mode: "reader",
			outline: EMPTY_OUTLINE,
			error: null,
		});
	},
}));

function basename(path: string): string {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments[segments.length - 1] || path;
}

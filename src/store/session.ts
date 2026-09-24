import type { Root } from "mdast";
import { create } from "zustand";
import { deriveOutline, type Outline } from "../reader/outline";

/**
 * The active view as a single value, not independent booleans: a combination
 * like `isEditing && isRawView` would be meaningless, and this makes it
 * unrepresentable instead of merely discouraged.
 */
export type ViewMode = "reader" | "raw" | "editor";

/**
 * A change made on disk, outside the application, to an open document that
 * the user has to answer before anything is written or discarded — see
 * design decision D6 of the workspace-explorer change. `modified` only arises
 * while the document is dirty; a clean document reloads silently instead.
 */
export type ExternalConflict = { kind: "modified" } | { kind: "deleted" };

/**
 * One open document — one tab. Peripheral, read-only-document state only:
 * its path, parsed tree (used by the reader and raw view, and to hydrate the
 * editor on open), mode, derived outline and dirty flag.
 *
 * While a document is open for editing, ProseMirror is the sole owner of its
 * *editable* content — this slice never holds a second, synced copy of it.
 * `tree` is a read-only snapshot with no caret to desynchronize, taken at
 * open time and replaced only by a reload from disk; it is not updated from
 * editor transactions. See design decision D4 of the document-editor-base
 * change.
 */
export interface OpenDocument {
	path: string;
	name: string;
	tree: Root;
	outline: Outline;
	mode: ViewMode;
	dirty: boolean;
	/**
	 * Bumped whenever the document is reloaded from disk, so its mounted
	 * editor knows to rehydrate rather than keep stale content.
	 */
	revision: number;
	conflict: ExternalConflict | null;
	/** Becomes true on first edit and keeps the editor mounted until the tab closes. */
	editorMounted?: boolean;
}

/**
 * The open documents, one of them active. Actions that concern "the"
 * document — mode changes, the outline, the reader — act on the active one;
 * actions that can come from any mounted editor take a path, because every
 * open document keeps its own editor mounted (design decision D7).
 */
export interface SessionState {
	documents: OpenDocument[];
	activePath: string | null;
	error: string | null;
	/**
	 * A passing, non-error message — for instance where a pasted image was
	 * written. Shown until dismissed or replaced.
	 */
	notice: string | null;

	/**
	 * Opens `filePath` as a new tab and activates it. If it is already open,
	 * only activates it: its editor, undo history and unsaved edits are kept.
	 */
	openDocument(filePath: string, tree: Root): void;
	activateDocument(filePath: string): void;
	/** Sets the active document's mode. */
	setMode(mode: ViewMode): void;
	/** Cycles the active document reader → raw → editor → reader. */
	cycleMode(): void;
	setError(message: string | null): void;
	setNotice(message: string | null): void;
	setDirty(filePath: string, dirty: boolean): void;
	/** Replaces a document's snapshot with a fresh read from disk. */
	reloadDocument(filePath: string, tree: Root): void;
	setConflict(filePath: string, conflict: ExternalConflict | null): void;
	/** Closes one document; the neighbouring tab becomes active if it was. */
	closeDocument(filePath: string): void;
}

const REACHABLE_MODE_CYCLE: readonly ViewMode[] = ["reader", "raw", "editor"];

export const useSessionStore = create<SessionState>()((set, get) => ({
	documents: [],
	activePath: null,
	error: null,
	notice: null,

	openDocument(filePath, tree) {
		const alreadyOpen = get().documents.some((document) => document.path === filePath);
		if (alreadyOpen) {
			set({ activePath: filePath, error: null });
			return;
		}

		const document: OpenDocument = {
			path: filePath,
			name: basename(filePath),
			tree,
			outline: deriveOutline(tree),
			mode: "reader",
			dirty: false,
			revision: 0,
			conflict: null,
			editorMounted: false,
		};

		set((state) => ({
			documents: [...state.documents, document],
			activePath: filePath,
			error: null,
		}));
	},

	activateDocument(filePath) {
		if (get().documents.some((document) => document.path === filePath)) {
			set({ activePath: filePath });
		}
	},

	setMode(mode) {
		const activePath = get().activePath;
		if (activePath !== null) {
			updateDocument(set, activePath, (document) => ({
				mode,
				editorMounted: document.editorMounted || mode === "editor",
			}));
		}
	},

	cycleMode() {
		const active = selectActiveDocument(get());
		if (!active) {
			return;
		}

		const currentIndex = REACHABLE_MODE_CYCLE.indexOf(active.mode);
		const nextIndex = (currentIndex + 1) % REACHABLE_MODE_CYCLE.length;
		updateDocument(set, active.path, () => ({ mode: REACHABLE_MODE_CYCLE[nextIndex] }));
	},

	setError(message) {
		set({ error: message });
	},

	setNotice(message) {
		set({ notice: message });
	},

	setDirty(filePath, dirty) {
		updateDocument(set, filePath, (document) => (document.dirty === dirty ? null : { dirty }));
	},

	reloadDocument(filePath, tree) {
		updateDocument(set, filePath, (document) => ({
			tree,
			outline: deriveOutline(tree),
			dirty: false,
			revision: document.revision + 1,
			conflict: null,
		}));
	},

	setConflict(filePath, conflict) {
		updateDocument(set, filePath, () => ({ conflict }));
	},

	closeDocument(filePath) {
		set((state) => {
			const index = state.documents.findIndex((document) => document.path === filePath);
			if (index < 0) {
				return state;
			}

			const documents = state.documents.filter((document) => document.path !== filePath);
			let activePath = state.activePath;
			if (activePath === filePath) {
				const neighbour = documents[Math.min(index, documents.length - 1)];
				activePath = neighbour ? neighbour.path : null;
			}

			return { documents, activePath };
		});
	},
}));

/** The active document, or `null` when none is open. */
export function selectActiveDocument(state: SessionState): OpenDocument | null {
	if (state.activePath === null) {
		return null;
	}

	return state.documents.find((document) => document.path === state.activePath) ?? null;
}

/** The open document at `filePath`, or `null` when it is not open. */
export function selectDocument(state: SessionState, filePath: string): OpenDocument | null {
	return state.documents.find((document) => document.path === filePath) ?? null;
}

type SetSession = (partial: (state: SessionState) => Partial<SessionState> | SessionState) => void;

/**
 * Applies `change` to one document, replacing only that entry so selectors on
 * other documents keep their identity. A `null` change is a no-op.
 */
function updateDocument(
	set: SetSession,
	filePath: string,
	change: (document: OpenDocument) => Partial<OpenDocument> | null,
): void {
	set((state) => {
		const index = state.documents.findIndex((document) => document.path === filePath);
		if (index < 0) {
			return state;
		}

		const patch = change(state.documents[index]);
		if (patch === null) {
			return state;
		}

		const documents = state.documents.slice();
		documents[index] = { ...documents[index], ...patch };
		return { documents };
	});
}

function basename(path: string): string {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments[segments.length - 1] || path;
}

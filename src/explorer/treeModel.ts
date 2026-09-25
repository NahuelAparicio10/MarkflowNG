import { baseName, parentPath } from "./paths";
import type { WorkspaceEntry } from "./types";

/** One visible row of the tree, flattened for the virtualizer. */
export interface TreeRow {
	path: string;
	name: string;
	depth: number;
	entry: WorkspaceEntry;
	expanded: boolean;
}

/** Each folder's children, sorted folders first, then by name. `""` is the root. */
export type ChildIndex = ReadonlyMap<string, readonly WorkspaceEntry[]>;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareEntries(a: WorkspaceEntry, b: WorkspaceEntry): number {
	if (a.kind !== b.kind) {
		return a.kind === "directory" ? -1 : 1;
	}
	return collator.compare(baseName(a.path), baseName(b.path));
}

/**
 * Groups the flat listing by parent folder. Rebuilt only when the listing
 * changes, not on expand or collapse.
 */
export function buildChildIndex(entries: ReadonlyMap<string, WorkspaceEntry>): ChildIndex {
	const index = new Map<string, WorkspaceEntry[]>();

	for (const entry of entries.values()) {
		const parent = parentPath(entry.path);
		const siblings = index.get(parent);
		if (siblings) {
			siblings.push(entry);
		} else {
			index.set(parent, [entry]);
		}
	}

	for (const siblings of index.values()) {
		siblings.sort(compareEntries);
	}

	return index;
}

/**
 * The rows currently visible: top-level entries, plus the children of every
 * expanded folder whose ancestors are expanded too. Collapsed folders cost
 * nothing, so this stays proportional to what is on screen or scrolled to,
 * not to the size of the workspace.
 */
export function flattenVisibleRows(index: ChildIndex, expanded: ReadonlySet<string>): TreeRow[] {
	const rows: TreeRow[] = [];

	const visit = (folder: string, depth: number) => {
		for (const entry of index.get(folder) ?? []) {
			const isExpanded = entry.kind === "directory" && expanded.has(entry.path);
			rows.push({ path: entry.path, name: baseName(entry.path), depth, entry, expanded: isExpanded });
			if (isExpanded) {
				visit(entry.path, depth + 1);
			}
		}
	};

	visit("", 0);
	return rows;
}

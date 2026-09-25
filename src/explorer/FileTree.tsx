import { useVirtualizer, type Rect } from "@tanstack/react-virtual";
import { useMemo, useRef, type KeyboardEvent } from "react";
import { useWorkspaceStore } from "../store/workspace";
import { parentPath } from "./paths";
import { buildChildIndex, flattenVisibleRows, type TreeRow } from "./treeModel";
import type { WorkspaceEntry } from "./types";

/** Fixed row height, so the virtualizer never has to measure a row. */
export const TREE_ROW_HEIGHT = 24;
const INDENT_PER_LEVEL = 12;

interface FileTreeProps {
	/** Opens a Markdown file, by root-relative path. */
	onOpen(relativePath: string): void;
	/**
	 * The viewport size assumed before the scroll container is first
	 * measured. Only the rows that fit it are rendered on the first paint;
	 * it also lets a render without a DOM, as in tests, show a real window.
	 */
	initialRect?: Rect;
}

/**
 * The workspace as a directory tree, reading the listing from the workspace
 * store. Selecting a Markdown file previews it; activating it (double click,
 * Enter) opens it. Other files are listed greyed out and do nothing.
 */
export default function FileTree({ onOpen, initialRect }: FileTreeProps) {
	const entries = useWorkspaceStore((state) => state.entries);
	const expanded = useWorkspaceStore((state) => state.expanded);
	const selectedPath = useWorkspaceStore((state) => state.selectedPath);

	return (
		<FileTreeView
			entries={entries}
			expanded={expanded}
			selectedPath={selectedPath}
			onOpen={onOpen}
			initialRect={initialRect}
		/>
	);
}

interface FileTreeViewProps extends FileTreeProps {
	entries: ReadonlyMap<string, WorkspaceEntry>;
	expanded: ReadonlySet<string>;
	selectedPath: string | null;
}

/**
 * The tree itself, given the listing. Virtualized from the start (design
 * decision D2): only the rows inside the viewport, plus a small overscan, are
 * mounted, however many entries the workspace holds.
 */
export function FileTreeView({ entries, expanded, selectedPath, onOpen, initialRect }: FileTreeViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const childIndex = useMemo(() => buildChildIndex(entries), [entries]);
	const rows = useMemo(() => flattenVisibleRows(childIndex, expanded), [childIndex, expanded]);

	// The rule warns that the React Compiler cannot memoize around this hook.
	// The project does not run the compiler, and nothing here passes the
	// virtualizer's functions into memoized children.
	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => TREE_ROW_HEIGHT,
		overscan: 10,
		initialRect,
	});

	function select(row: TreeRow) {
		const workspace = useWorkspaceStore.getState();
		workspace.select(row.path);
		if (row.entry.kind === "file" && row.entry.markdown) {
			workspace.setPreview(row.path);
		}
	}

	function activate(row: TreeRow) {
		if (row.entry.kind === "directory") {
			useWorkspaceStore.getState().setExpanded(row.path, !row.expanded);
		} else if (row.entry.markdown) {
			onOpen(row.path);
		}
	}

	function moveSelection(index: number) {
		const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
		if (row) {
			select(row);
			virtualizer.scrollToIndex(rows.indexOf(row));
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const index = rows.findIndex((row) => row.path === selectedPath);
		const row = index >= 0 ? rows[index] : null;

		switch (event.key) {
			case "ArrowDown": {
				moveSelection(index + 1);
				break;
			}
			case "ArrowUp": {
				moveSelection(index < 0 ? 0 : index - 1);
				break;
			}
			case "ArrowRight": {
				if (row?.entry.kind === "directory") {
					if (row.expanded) {
						moveSelection(index + 1);
					} else {
						useWorkspaceStore.getState().setExpanded(row.path, true);
					}
				}
				break;
			}
			case "ArrowLeft": {
				if (row?.expanded) {
					useWorkspaceStore.getState().setExpanded(row.path, false);
				} else if (row) {
					const parent = parentPath(row.path);
					if (parent !== "") {
						moveSelection(rows.findIndex((candidate) => candidate.path === parent));
					}
				}
				break;
			}
			case "Enter": {
				if (row) {
					activate(row);
				}
				break;
			}
			default:
				return;
		}

		event.preventDefault();
	}

	return (
		<div
			ref={scrollRef}
			className="markflow-tree"
			role="tree"
			aria-label="Workspace files"
			tabIndex={0}
			onKeyDown={handleKeyDown}
		>
			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
				{virtualizer.getVirtualItems().map((item) => {
					const row = rows[item.index];
					const isOpenable = row.entry.kind === "directory" || row.entry.markdown;
					const classes = ["markflow-tree-row"];
					if (row.path === selectedPath) {
						classes.push("markflow-tree-row-selected");
					}
					if (!isOpenable) {
						classes.push("markflow-tree-row-inert");
					}

					return (
						<div
							key={row.path}
							role="treeitem"
							aria-level={row.depth + 1}
							aria-selected={row.path === selectedPath}
							aria-expanded={row.entry.kind === "directory" ? row.expanded : undefined}
							aria-disabled={isOpenable ? undefined : true}
							data-path={row.path}
							className={classes.join(" ")}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: TREE_ROW_HEIGHT,
								transform: `translateY(${item.start}px)`,
								paddingLeft: row.depth * INDENT_PER_LEVEL + 8,
							}}
							onClick={() => {
								select(row);
								if (row.entry.kind === "directory") {
									activate(row);
								}
							}}
							onDoubleClick={() => {
								if (row.entry.kind === "file") {
									activate(row);
								}
							}}
						>
							<span className="markflow-tree-twisty" aria-hidden="true">
								{row.entry.kind === "directory" ? (row.expanded ? "▾" : "▸") : ""}
							</span>
							{row.name}
						</div>
					);
				})}
			</div>
		</div>
	);
}

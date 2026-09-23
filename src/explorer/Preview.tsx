import type { Root } from "mdast";
import { useEffect, useMemo, useState } from "react";
import { parseMarkdown } from "../core/markdown";
import { readTextFile } from "../editor/fs";
import { renderMdast } from "../reader/renderMdast";

interface PreviewProps {
	/** Absolute path of the Markdown file to preview. */
	path: string;
	/** Opens the previewed file as a tab. */
	onOpen(): void;
}

type Loaded = { path: string; tree: Root } | { path: string; error: string };

/**
 * A read-only look at a workspace file without opening it: read, parsed with
 * the core parser and rendered by the reader's own renderer — never a second
 * rendering path, and never an editor instance (design decision D4). That is
 * what keeps moving the selection through the tree instant.
 *
 * While the next file loads, the previous one stays on screen rather than
 * flashing an empty pane.
 */
export default function Preview({ path, onOpen }: PreviewProps) {
	const [loaded, setLoaded] = useState<Loaded | null>(null);

	useEffect(() => {
		let cancelled = false;

		readTextFile(path).then(
			(source) => {
				if (!cancelled) {
					setLoaded({ path, tree: parseMarkdown(source) });
				}
			},
			(error: unknown) => {
				if (!cancelled) {
					setLoaded({ path, error: error instanceof Error ? error.message : String(error) });
				}
			},
		);

		return () => {
			cancelled = true;
		};
	}, [path]);

	return (
		<div className="markflow-preview">
			<div className="markflow-preview-bar">
				<span>Preview</span>
				<button type="button" onClick={onOpen}>
					Open
				</button>
			</div>
			{loaded && "error" in loaded ? (
				<p className="markflow-preview-error">Could not preview this file: {loaded.error}</p>
			) : null}
			{loaded && "tree" in loaded ? <PreviewContent tree={loaded.tree} documentPath={loaded.path} /> : null}
		</div>
	);
}

/**
 * The rendered document: exactly what reader mode shows for the same tree.
 * `documentPath` is where relative image references resolve from.
 */
export function PreviewContent({ tree, documentPath = null }: { tree: Root; documentPath?: string | null }) {
	const content = useMemo(() => renderMdast(tree, undefined, documentPath), [tree, documentPath]);

	return <div className="markflow-prose markflow-reader">{content}</div>;
}

import type { Root } from "mdast";
import { useMemo } from "react";
import { serializeMarkdown } from "../core/markdown";

interface RawViewProps {
	tree: Root;
}

/**
 * Shows the document as Markdown text, serialized from the current in-memory
 * tree rather than re-read from disk, so it reflects what would be written on
 * save rather than what is on disk right now — see design decision in
 * "Raw view and disk drift once autosave exists".
 */
export default function RawView({ tree }: RawViewProps) {
	const source = useMemo(() => serializeMarkdown(tree), [tree]);

	return (
		<div className="markflow-raw">
			<p className="markflow-raw-notice">Shown as it would be saved, not necessarily as it is on disk.</p>
			<pre className="markflow-raw-content">{source}</pre>
		</div>
	);
}

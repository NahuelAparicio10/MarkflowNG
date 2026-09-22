import { useMemo } from "react";
import { useSessionStore } from "../store/session";
import { renderMdast } from "./renderMdast";

/**
 * Formatted, read-only rendering of the currently open document. No caret, no
 * editing toolbar, no ProseMirror instance — see design decision D1.
 */
export default function ReaderView() {
	const tree = useSessionStore((state) => state.tree);
	const outline = useSessionStore((state) => state.outline);

	const content = useMemo(() => (tree ? renderMdast(tree, outline) : null), [tree, outline]);

	if (!tree) {
		return null;
	}

	return <div className="markflow-prose markflow-reader">{content}</div>;
}

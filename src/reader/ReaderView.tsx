import { useMemo } from "react";
import { selectActiveDocument, useSessionStore } from "../store/session";
import { renderMdast } from "./renderMdast";

/**
 * Formatted, read-only rendering of the active document. No caret, no
 * editing toolbar, no ProseMirror instance — see design decision D1.
 */
export default function ReaderView() {
	const tree = useSessionStore((state) => selectActiveDocument(state)?.tree ?? null);
	const outline = useSessionStore((state) => selectActiveDocument(state)?.outline ?? null);
	const path = useSessionStore((state) => selectActiveDocument(state)?.path ?? null);

	const content = useMemo(
		() => (tree && outline ? renderMdast(tree, outline, path) : null),
		[tree, outline, path],
	);

	if (!tree) {
		return null;
	}

	return <div className="markflow-prose markflow-reader">{content}</div>;
}

import type { OutlineEntry } from "../reader/outline";
import { joinWorkspacePath } from "../explorer/paths";
import { openFileAtPath } from "../store/openFile";
import { selectDocument, useSessionStore } from "../store/session";
import { useWorkspaceStore } from "../store/workspace";
import type { Citation } from "./workspace";

export function citationAnchor(entries: readonly OutlineEntry[], headings: readonly string[]): string | null {
	const path: OutlineEntry[] = [];
	for (const entry of entries) {
		while (path.length && path[path.length - 1].depth >= entry.depth) path.pop();
		path.push(entry);
		if (path.length === headings.length && path.every((value, index) => value.text === headings[index])) return entry.id;
	}
	return null;
}

export async function openCitation(root: string, citation: Citation): Promise<void> {
	if (citation.file.split(/[\\/]/).some((part) => part === "..") || /^[\\/]|^[a-z]:/i.test(citation.file)) return;
	const path = joinWorkspacePath(root, citation.file);
	useWorkspaceStore.getState().setPreview(null);
	await openFileAtPath(path);
	const session = useSessionStore.getState();
	const document = selectDocument(session, path);
	if (!document || session.activePath !== path) return;
	session.setMode("reader");
	if (!citation.headings.length) return;
	const anchor = citationAnchor(document.outline.entries, citation.headings);
	if (!anchor) {
		session.setNotice("The cited section was not found. The document may have changed.");
		return;
	}
	requestAnimationFrame(() => {
		if (useSessionStore.getState().activePath === path) documentElement(anchor)?.scrollIntoView({ block: "start" });
	});
}

function documentElement(id: string) { return document.getElementById(id); }

import type { Node as PmNode } from "@tiptap/pm/model";
import { mdastToPm } from "../core/mapping";
import { parseMarkdown } from "../core/markdown";
import { recordLoadedContent } from "../explorer/selfWrites";
import { readTextFile } from "./fs";

/**
 * Loads a document for the editor: reads the file, parses it with the core
 * parser and maps the result to a ProseMirror document.
 *
 * There is exactly one load path and it goes through `src/core/` — see the
 * "Hydrating the editor from a file" spec requirement. This function
 * returns the document rather than hydrating an `Editor` instance itself,
 * so it can be exercised directly in tests without a real, DOM-backed
 * ProseMirror view.
 */
export async function loadDocument(path: string): Promise<PmNode> {
	const source = await readTextFile(path);
	recordLoadedContent(path, source);
	const tree = parseMarkdown(source);

	return mdastToPm(tree);
}

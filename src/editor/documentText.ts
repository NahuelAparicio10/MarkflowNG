import type { Node as PmNode } from "@tiptap/pm/model";
import { pmToMdast } from "../core/mapping";
import { serializeMarkdown } from "../core/markdown";

/**
 * The single place a ProseMirror document becomes the text that would be
 * written to disk. Both the save path and dirty detection go through this,
 * so "what would be saved" has exactly one definition.
 */
export function serializeDoc(doc: PmNode): string {
	return serializeMarkdown(pmToMdast(doc));
}

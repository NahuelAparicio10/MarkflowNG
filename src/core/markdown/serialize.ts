import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { STRINGIFY_OPTIONS } from "./options";

const processor = unified()
	.use(remarkStringify, STRINGIFY_OPTIONS)
	.use(remarkGfm)
	.use(remarkFrontmatter, ["yaml"]);

/**
 * Serializes an mdast tree back to Markdown.
 *
 * Takes no options parameter by design: the serializer normal form is defined
 * once in `options.ts` and must be identical everywhere, or the round-trip
 * invariant has no fixed meaning to be tested against.
 */
export function serializeMarkdown(tree: Root): string {
	return processor.stringify(tree);
}

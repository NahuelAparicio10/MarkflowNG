import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkFrontmatter, ["yaml"]);

/**
 * Parses Markdown into the canonical mdast tree.
 *
 * This is the only parsing entry point in the application. The reader, the
 * editor, the explorer preview and the AI layer all consume the tree it
 * produces, which is what lets them share one representation.
 *
 * GFM is enabled so tables, strikethrough and task lists parse as structure
 * rather than as text, and frontmatter is enabled so a `---` delimited block
 * becomes a `yaml` node instead of being mis-parsed as a thematic break.
 */
export function parseMarkdown(source: string): Root {
	return processor.parse(source);
}

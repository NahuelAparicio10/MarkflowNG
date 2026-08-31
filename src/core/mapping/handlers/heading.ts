import type { Heading, PhrasingContent } from "mdast";
import { HEADING_LEVELS, type HeadingLevel } from "../../schema";
import { defineNodeHandler } from "../registry";

function assertHeadingLevel(depth: number): HeadingLevel {
	if (!HEADING_LEVELS.includes(depth as HeadingLevel)) {
		throw new RangeError(`Invalid heading depth: ${depth}`);
	}

	return depth as HeadingLevel;
}

export const headingHandler = defineNodeHandler<Heading>({
	mdastType: "heading",
	pmType: "heading",

	toPm(node, { schema, convertChildren }) {
		// An mdast depth is the real entry point for a heading level, so the
		// range is enforced here rather than relying on ProseMirror's attribute
		// validator, which only runs on check() and fromJSON().
		const level = assertHeadingLevel(node.depth);

		return [schema.node("heading", { level }, convertChildren(node, true))];
	},

	toMdast(node, { convertChildren }) {
		return [
			{
				type: "heading",
				depth: assertHeadingLevel(node.attrs.level as number),
				children: convertChildren(node) as PhrasingContent[],
			},
		];
	},
});

import type { Code } from "mdast";
import { defineNodeHandler } from "../registry";

/**
 * The fence's language is the node's `language` attribute, mapped straight to
 * mdast `lang` — never recovered from a rendered class name. See design
 * decision D6.
 */
export const codeBlockHandler = defineNodeHandler<Code>({
	mdastType: "code",
	pmType: "codeBlock",

	toPm(node, { schema }) {
		const attrs = { language: node.lang ?? null, meta: node.meta ?? null };
		// ProseMirror forbids empty text nodes, and an empty fence is valid.
		const content = node.value === "" ? [] : [schema.text(node.value)];

		return [schema.node("codeBlock", attrs, content)];
	},

	toMdast(node) {
		return [
			{
				type: "code",
				lang: node.attrs.language as string | null,
				meta: node.attrs.meta as string | null,
				value: node.textContent,
			},
		];
	},
});

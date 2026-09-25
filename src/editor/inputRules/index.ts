import { Extension } from "@tiptap/core";
import { blockquoteRule } from "./blockquote";
import { bulletListRule } from "./bulletList";
import { codeBlockRule } from "./codeBlock";
import { emphasisRules } from "./emphasis";
import { headingRule } from "./heading";
import { inlineCodeRule } from "./inlineCode";
import { orderedListRule } from "./orderedList";
import { createInputRulesPlugin } from "./plugin";
import { strikethroughRule } from "./strikethrough";
import { strongRules } from "./strong";
import { taskItemRule } from "./taskItem";
import { thematicBreakRule } from "./thematicBreak";
import type { MarkdownInputRule } from "./types";

/**
 * Every input rule, in the order they are tried. Order matters where two
 * patterns can match the same text: strong before emphasis, since `**x**`
 * ends with a `*` that would also close `*x*`.
 */
export const INPUT_RULES: readonly MarkdownInputRule[] = [
	headingRule,
	taskItemRule,
	bulletListRule,
	orderedListRule,
	blockquoteRule,
	codeBlockRule,
	thematicBreakRule,
	...strongRules,
	...emphasisRules,
	strikethroughRule,
	inlineCodeRule,
];

/**
 * Runs ahead of the shortcut table so that Enter after a code fence converts it
 * rather than splitting the paragraph.
 */
export function createInputRulesExtension(isEnabled: () => boolean) {
	return Extension.create({
		name: "markflowInputRules",
		priority: 1100,

		addProseMirrorPlugins() {
			return [createInputRulesPlugin(INPUT_RULES, isEnabled)];
		},
	});
}

export { createInputRulesPlugin, inputRulesKey } from "./plugin";
export type { MarkdownInputRule } from "./types";

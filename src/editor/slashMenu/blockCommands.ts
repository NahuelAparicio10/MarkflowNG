import { setBlockType } from "@tiptap/pm/commands";
import type { Attrs } from "@tiptap/pm/model";
import { type Command, TextSelection } from "@tiptap/pm/state";
import { isInTable } from "@tiptap/pm/tables";
import { HEADING_LEVELS } from "../../core/schema";
import { insertImages } from "../images";
import { wrapParagraph } from "../inputRules/blockRule";
import { insertTable } from "../tables";
import type { SlashCommandRegistry } from "./registry";
import type { SlashCommand } from "./types";

/**
 * The block insertion entries: one per block type the editor can insert. Each
 * runs against the paragraph the menu was opened in, already emptied of the
 * trigger text, so it only has to turn that empty paragraph into its block.
 */

const GROUP_TEXT = "Text";
const GROUP_LISTS = "Lists";
const GROUP_INSERT = "Insert";

const always = () => true;

/** Wraps the empty paragraph at the caret, as the matching input rule does. */
function wrapCaretParagraph(typeName: string, attrs: Attrs | null = null, innerAttrs: Attrs | null = null): Command {
	return (state, dispatch) => {
		const pos = state.selection.from;
		const tr = wrapParagraph(state, pos, pos, state.schema.nodes[typeName], attrs, innerAttrs);
		if (!tr) {
			return false;
		}

		dispatch?.(tr);
		return true;
	};
}

/** Replaces the empty paragraph with a rule, and opens a paragraph after it for the caret. */
const insertRule: Command = (state, dispatch) => {
	const { $from } = state.selection;
	if ($from.parent.type !== state.schema.nodes.paragraph) {
		return false;
	}

	const before = $from.before();
	const tr = state.tr.replaceWith(before, $from.after(), [
		state.schema.nodes.thematicBreak.create(),
		state.schema.nodes.paragraph.create(),
	]);

	// The rule is a leaf of size 1, so the new paragraph opens right after it.
	dispatch?.(tr.setSelection(TextSelection.create(tr.doc, before + 2)));
	return true;
};

function syncCommand(entry: Omit<SlashCommand, "run" | "isAvailable"> & { command: Command; isAvailable?: SlashCommand["isAvailable"] }): SlashCommand {
	const { command, isAvailable = always, ...rest } = entry;

	return {
		...rest,
		isAvailable,
		async run(context) {
			context.replaceTrigger(command);
		},
	};
}

const headingCommands: SlashCommand[] = HEADING_LEVELS.map((level) =>
	syncCommand({
		id: `heading${level}`,
		label: `Heading ${level}`,
		keywords: [`h${level}`, "heading", "title", "header"],
		group: GROUP_TEXT,
		command: (state, dispatch) => setBlockType(state.schema.nodes.heading, { level })(state, dispatch),
	}),
);

export const BLOCK_COMMANDS: readonly SlashCommand[] = [
	...headingCommands,
	syncCommand({
		id: "blockquote",
		label: "Quote",
		keywords: ["blockquote", "quotation", "citation", ">"],
		group: GROUP_TEXT,
		command: wrapCaretParagraph("blockquote"),
	}),
	syncCommand({
		id: "codeBlock",
		label: "Code block",
		keywords: ["code", "snippet", "pre", "fence", "```", "program"],
		group: GROUP_TEXT,
		command: (state, dispatch) => setBlockType(state.schema.nodes.codeBlock, { language: null })(state, dispatch),
	}),
	syncCommand({
		id: "bulletList",
		label: "Bulleted list",
		keywords: ["bullet", "unordered", "ul", "list", "-", "*"],
		group: GROUP_LISTS,
		command: wrapCaretParagraph("list", { ordered: false, start: null }),
	}),
	syncCommand({
		id: "orderedList",
		label: "Numbered list",
		keywords: ["numbered", "ordered", "ol", "list", "1."],
		group: GROUP_LISTS,
		command: wrapCaretParagraph("list", { ordered: true, start: 1 }),
	}),
	syncCommand({
		id: "taskList",
		label: "Task list",
		keywords: ["todo", "to-do", "checkbox", "checklist", "task", "list", "[ ]"],
		group: GROUP_LISTS,
		command: wrapCaretParagraph("list", { ordered: false, start: null }, { checked: false, spread: false }),
	}),
	syncCommand({
		id: "table",
		label: "Table",
		keywords: ["grid", "rows", "columns", "spreadsheet", "cells"],
		group: GROUP_INSERT,
		// GFM has no nested tables.
		isAvailable: (state) => !isInTable(state),
		command: insertTable(),
	}),
	{
		id: "image",
		label: "Image",
		keywords: ["picture", "photo", "img", "figure", "screenshot", "media"],
		group: GROUP_INSERT,
		isAvailable: always,
		async run(context) {
			// Choosing a file happens before the insertion, so cancelling the
			// dialog leaves the typed text just as dismissing the menu does.
			const images = await context.host.chooseImages();
			if (images.length > 0) {
				context.replaceTrigger(insertImages(images));
			}
		},
	},
	syncCommand({
		id: "thematicBreak",
		label: "Horizontal rule",
		keywords: ["divider", "separator", "line", "hr", "rule", "---", "break"],
		group: GROUP_INSERT,
		command: insertRule,
	}),
];

/** Registers every block entry; returns a function that removes them again. */
export function registerBlockCommands(registry: SlashCommandRegistry): () => void {
	const unregister = BLOCK_COMMANDS.map((command) => registry.register(command));

	return () => unregister.forEach((remove) => remove());
}

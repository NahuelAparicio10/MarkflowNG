import { Extension } from "@tiptap/core";
import { registerBlockCommands } from "./blockCommands";
import { createSlashMenuPlugin } from "./plugin";
import { slashCommands } from "./registry";
import type { SlashCommandHost } from "./types";

// The built-in entries. Other modules contribute theirs the same way, by
// registering with `slashCommands`.
registerBlockCommands(slashCommands);

/**
 * Runs ahead of the input rules and the shortcut table, so that while the menu
 * is open its keys — arrows, Enter, Tab, Escape — reach it first.
 */
export function createSlashMenuExtension(host: SlashCommandHost) {
	return Extension.create({
		name: "markflowSlashMenu",
		priority: 1200,

		addProseMirrorPlugins() {
			return [createSlashMenuPlugin(slashCommands, host)];
		},
	});
}

export { BLOCK_COMMANDS, registerBlockCommands } from "./blockCommands";
export { closeSlashMenu, createSlashMenuPlugin, runSlashMenuItem, slashMenuKey, type SlashMenuState } from "./plugin";
export { createSlashCommandRegistry, findSlashCommands, slashCommands, type SlashCommandRegistry } from "./registry";
export type { SlashCommand, SlashCommandContext, SlashCommandHost } from "./types";

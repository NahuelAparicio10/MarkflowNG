import { Extension } from "@tiptap/core";
import { registerAiCommands } from "../../ai/commands";
import { useAiSettings } from "../../ai/provider/settings";
import { toWorkspaceRelative } from "../../explorer/paths";
import { selectActiveDocument, useSessionStore } from "../../store/session";
import { useWorkspaceStore } from "../../store/workspace";
import { registerBlockCommands } from "./blockCommands";
import { createSlashMenuPlugin } from "./plugin";
import { slashCommands } from "./registry";
import type { SlashCommandHost } from "./types";

// The built-in entries. Other modules contribute theirs the same way, by
// registering with `slashCommands`.
registerBlockCommands(slashCommands);
registerAiCommands(slashCommands, () => {
	const root = useWorkspaceStore.getState().root;
	const document = selectActiveDocument(useSessionStore.getState());
	return root && document && toWorkspaceRelative(root, document.path) !== null
		? useAiSettings.getState().providers.get(root) : undefined;
});

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

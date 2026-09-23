import { Extension } from "@tiptap/core";
import { chainCommands } from "@tiptap/pm/commands";
import type { Command } from "@tiptap/pm/state";
import { enterInList, indentListItem, outdentListItem, toggleMarkCommand } from "./commands";
import { enterInTable, moveToCell } from "./tables";

/**
 * The single declaration point for keyboard shortcuts — see the "Shortcuts
 * declared centrally" spec scenario. Every binding in the app is listed here,
 * including the app-level ones handled outside the editor, so a conflict is
 * visible and resolved in one place.
 *
 * Key names use ProseMirror's notation; `Mod` is Ctrl on Windows and Linux and
 * Cmd on macOS.
 *
 * Reviewed against the Windows, Edge and WebView2 shortcut lists (task 3.4):
 * - `Mod-e` is taken by the app's view-mode cycle, so inline code uses
 *   `Mod-Shift-e` instead of the `Mod-e` most editors use. The mode shortcut
 *   matches modifiers exactly, so the two do not both fire.
 * - Strikethrough uses `Mod-Shift-x` rather than `Mod-Shift-s`, which Edge
 *   binds to web capture and which reads as "Save As".
 * - `Mod-b`, `Mod-i` and `Mod-k` are browser shortcuts in Edge/Chrome (favorites
 *   bar, search), but pages may override them, and WebView2 has no browser UI
 *   for them to reach.
 * - No binding uses `Alt` alone, which Windows reserves for menu access, or
 *   `Mod-Shift-i`/`Mod-Shift-c`/`F12`, which open developer tools in dev builds.
 * - Quick open takes `Mod-p`, as `Context/EXPLORE.md` specifies and as most
 *   editors do. It shadows print in Edge/Chrome, which a page may override, and
 *   WebView2 has no print UI of its own to lose.
 */
export const SHORTCUTS = {
	strong: "Mod-b",
	emphasis: "Mod-i",
	strikethrough: "Mod-Shift-x",
	inlineCode: "Mod-Shift-e",
	link: "Mod-k",
	/**
	 * Enter, Tab and Shift-Tab each serve lists and tables. A table cell cannot
	 * hold a list, so the two never compete for the same caret: the table
	 * command runs first and declines outside a table.
	 */
	listEnter: "Enter",
	listIndent: "Tab",
	listOutdent: "Shift-Tab",
	/** App level, handled in `useSaveShortcut`. */
	save: "Mod-s",
	/** App level, handled in `useModeShortcut`. */
	cycleMode: "Mod-e",
	/** App level, handled in `useQuickOpenShortcut`. */
	quickOpen: "Mod-p",
} as const;

export type ShortcutName = keyof typeof SHORTCUTS;

function isMacPlatform(): boolean {
	return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * Whether a DOM keyboard event is exactly the shortcut `name`, for app-level
 * bindings that live outside ProseMirror's keymap. Modifiers must match
 * exactly, so `Mod-e` does not also fire on `Mod-Shift-e`.
 */
export function matchesShortcut(event: KeyboardEvent, name: ShortcutName): boolean {
	const parts = SHORTCUTS[name].split("-");
	const key = parts[parts.length - 1].toLowerCase();
	const modifiers = new Set(parts.slice(0, -1));
	const mac = isMacPlatform();

	const wantsCtrl = modifiers.has("Ctrl") || (modifiers.has("Mod") && !mac);
	const wantsMeta = modifiers.has("Meta") || (modifiers.has("Mod") && mac);

	return (
		event.key.toLowerCase() === key &&
		event.ctrlKey === wantsCtrl &&
		event.metaKey === wantsMeta &&
		event.shiftKey === modifiers.has("Shift") &&
		event.altKey === modifiers.has("Alt")
	);
}

/**
 * Binds the editor half of the shortcut table. Runs ahead of Tiptap's own base
 * keymap, so Enter in a list item is handled here before the default split.
 */
export function createShortcutsExtension(onOpenLink: () => void) {
	return Extension.create({
		name: "markflowShortcuts",
		priority: 1000,

		addKeyboardShortcuts() {
			const run = (command: Command) => () => command(this.editor.state, this.editor.view.dispatch);

			return {
				[SHORTCUTS.strong]: run(toggleMarkCommand("strong")),
				[SHORTCUTS.emphasis]: run(toggleMarkCommand("emphasis")),
				[SHORTCUTS.strikethrough]: run(toggleMarkCommand("strikethrough")),
				[SHORTCUTS.inlineCode]: run(toggleMarkCommand("inlineCode")),
				[SHORTCUTS.link]: () => {
					onOpenLink();
					return true;
				},
				[SHORTCUTS.listEnter]: run(chainCommands(enterInTable, enterInList)),
				[SHORTCUTS.listIndent]: run(chainCommands(moveToCell(1), indentListItem)),
				[SHORTCUTS.listOutdent]: run(chainCommands(moveToCell(-1), outdentListItem)),
			};
		},
	});
}

import type { Command, EditorState } from "@tiptap/pm/state";
import type { ImageAttrs } from "../images";

/**
 * What a command may ask of the application hosting the editor, for work the
 * editor cannot do by itself. Phase 7 extends this with what generative
 * commands need.
 */
export interface SlashCommandHost {
	/** Asks the user for images to insert; resolves to none when they cancel. */
	chooseImages(): Promise<ImageAttrs[]>;
}

export interface SlashCommandContext {
	/** The current state, read fresh on every call: it may change while a command awaits. */
	getState(): EditorState;
	host: SlashCommandHost;
	/**
	 * Replaces the trigger text — the slash and the filter typed after it — with
	 * the effect of `command`, as a single transaction and a single undo step
	 * (design decision D6). The command runs against the paragraph as it is
	 * with the trigger text already removed.
	 *
	 * Returns `false`, changing nothing, when `command` declines or when the
	 * menu was dismissed while the command was awaiting.
	 */
	replaceTrigger(command: Command): boolean;
}

/**
 * One entry of the slash menu (design decision D2). Declared in the registry,
 * never in the menu component, so other modules can contribute entries.
 */
export interface SlashCommand {
	/** Unique across the registry; registering the same id again replaces the entry. */
	id: string;
	label: string;
	/** Further terms the filter matches, for users who do not know the label. */
	keywords: readonly string[];
	/** The menu section the entry is listed under. Sections appear in registration order. */
	group: string;
	/** Whether the entry is offered in `state`; unavailable entries are hidden. */
	isAvailable(state: EditorState): boolean;
	/**
	 * Asynchronous by contract (design decision D3): a synchronous command
	 * resolves immediately, and the menu shows a pending state until it does.
	 * A command that resolves without calling `replaceTrigger` leaves the typed
	 * text in place, as dismissing the menu does.
	 */
	run(context: SlashCommandContext): Promise<void>;
}

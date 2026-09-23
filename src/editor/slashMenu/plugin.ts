import { closeHistory } from "@tiptap/pm/history";
import { type Command, EditorState, Plugin, PluginKey, Selection, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { findSlashCommands, type SlashCommandRegistry } from "./registry";
import type { SlashCommand, SlashCommandContext, SlashCommandHost } from "./types";

export interface SlashMenuState {
	active: boolean;
	/** Document position of the slash that opened the menu. */
	from: number;
	/** What was typed after the slash. */
	query: string;
	/** The entries shown, in display order. */
	items: SlashCommand[];
	/** Index into `items` of the highlighted entry. */
	selected: number;
	/** A command is running and has not resolved yet. */
	pending: boolean;
	/** Counts menu openings, so a command that outlives its menu cannot act on a later one. */
	session: number;
	/** The last document change was a command's insertion. */
	justInserted: boolean;
}

type SlashMenuAction =
	| { type: "open"; from: number }
	| { type: "close" }
	| { type: "select"; index: number }
	| { type: "pending" }
	| { type: "inserted" };

export const slashMenuKey = new PluginKey<SlashMenuState>("markflowSlashMenu");

function closedState(session: number, justInserted: boolean): SlashMenuState {
	return { active: false, from: 0, query: "", items: [], selected: 0, pending: false, session, justInserted };
}

/**
 * Where the menu may open (design decision D1): an empty paragraph, never a
 * code block, and not with inline code about to be typed — so a slash in a
 * sentence, a path or a code sample is always just a slash.
 */
function canOpenAt(state: EditorState, from: number, to: number): boolean {
	if (from !== to) {
		return false;
	}

	const $from = state.doc.resolve(from);
	const block = $from.parent;
	if (block.type !== state.schema.nodes.paragraph || block.type.spec.code || block.content.size !== 0) {
		return false;
	}

	const marks = state.storedMarks ?? $from.marks();

	return !marks.some((mark) => mark.type.spec.code);
}

/**
 * The filter typed after the slash at `from`, or `null` once the menu no
 * longer applies: the slash was deleted, or the caret left the text after it.
 */
function readQuery(state: EditorState, from: number): string | null {
	const { selection } = state;
	if (!(selection instanceof TextSelection) || !selection.$cursor) {
		return null;
	}

	const $slash = state.doc.resolve(from);
	const $cursor = selection.$cursor;
	if ($slash.parentOffset !== 0 || $cursor.parent !== $slash.parent || $cursor.pos <= from) {
		return null;
	}

	if (state.doc.textBetween(from, from + 1) !== "/") {
		return null;
	}

	return state.doc.textBetween(from + 1, $cursor.pos);
}

/**
 * Builds the single transaction of design decision D6: the trigger text is
 * deleted and `command`'s changes follow in the same transaction, which
 * starts its own undo step. `command` runs against a scratch state holding
 * the document with the trigger text already gone.
 */
function buildReplacement(state: EditorState, menu: SlashMenuState, command: Command): Transaction | null {
	const tr = state.tr.delete(menu.from, menu.from + 1 + menu.query.length);
	const scratch = EditorState.create({ schema: state.schema, doc: tr.doc, selection: tr.selection });

	let commandTr: Transaction | null = null;
	const applies = command(scratch, (built) => {
		commandTr = built;
	});
	if (!applies || !commandTr) {
		return null;
	}

	const built: Transaction = commandTr;
	for (const step of built.steps) {
		tr.step(step);
	}
	if (built.selectionSet) {
		tr.setSelection(Selection.fromJSON(tr.doc, built.selection.toJSON()));
	}
	if (built.storedMarksSet) {
		tr.setStoredMarks(built.storedMarks);
	}

	closeHistory(tr);
	tr.setMeta(slashMenuKey, { type: "inserted" } satisfies SlashMenuAction);

	return tr.scrollIntoView();
}

function dispatchAction(view: EditorView, action: SlashMenuAction) {
	view.dispatch(view.state.tr.setMeta(slashMenuKey, action));
}

/**
 * Runs the entry at `index` of the open menu. The menu shows a pending state
 * until the command resolves (design decision D3), then closes. Resolves to
 * whether the command inserted anything.
 */
export async function runSlashMenuItem(view: EditorView, index: number): Promise<boolean> {
	const menu = slashMenuKey.getState(view.state);
	const command = menu?.items[index];
	if (!menu?.active || menu.pending || !command) {
		return false;
	}

	const host = slashMenuKey.get(view.state)!.spec.host as SlashCommandHost;

	const session = menu.session;
	const isCurrentSession = () => {
		const current = slashMenuKey.getState(view.state);
		return !view.isDestroyed && current?.active === true && current.session === session;
	};

	let inserted = false;
	const context: SlashCommandContext = {
		getState: () => view.state,
		host,
		replaceTrigger(replacement) {
			if (!isCurrentSession()) {
				return false;
			}

			const tr = buildReplacement(view.state, slashMenuKey.getState(view.state)!, replacement);
			if (!tr) {
				return false;
			}

			view.dispatch(tr);
			inserted = true;
			return true;
		},
	};

	dispatchAction(view, { type: "pending" });
	try {
		await command.run(context);
	} finally {
		// A command that resolved without inserting leaves the typed text, as dismissal does.
		if (isCurrentSession()) {
			dispatchAction(view, { type: "close" });
		}
	}

	return inserted;
}

/** Closes the menu, leaving the slash and the filter as typed text (design decision D4). */
export function closeSlashMenu(view: EditorView) {
	if (slashMenuKey.getState(view.state)?.active) {
		dispatchAction(view, { type: "close" });
	}
}

/**
 * The slash menu's state and keyboard handling. The menu's entries come from
 * `registry`; the popup that draws them is `src/ui/SlashMenu.tsx`.
 *
 * While the menu is open it takes the arrow keys, Enter, Tab and Escape
 * ahead of every editor binding, and types the filter itself so that no input
 * rule ever converts it. Closed, it handles nothing but the opening slash.
 */
export function createSlashMenuPlugin(registry: SlashCommandRegistry, host: SlashCommandHost) {
	return new Plugin<SlashMenuState>({
		key: slashMenuKey,
		host,

		state: {
			init: () => closedState(0, false),

			apply(tr, previous, _oldState, state) {
				const action = tr.getMeta(slashMenuKey) as SlashMenuAction | undefined;
				const justInserted = action?.type === "inserted" || (!tr.docChanged && previous.justInserted);

				let from: number;
				let session = previous.session;
				if (action?.type === "open") {
					from = action.from;
					session += 1;
				} else if (!previous.active || action?.type === "close" || action?.type === "inserted") {
					return previous.active || previous.justInserted !== justInserted ? closedState(session, justInserted) : previous;
				} else {
					from = tr.mapping.map(previous.from);
				}

				const query = readQuery(state, from);
				const items = query === null ? [] : findSlashCommands(registry, state, query);
				// No match closes the menu and leaves the typed text (design decision D4).
				if (query === null || items.length === 0) {
					return closedState(session, justInserted);
				}

				let selected = 0;
				if (action?.type === "select") {
					selected = action.index;
				} else if (action?.type !== "open" && query === previous.query) {
					selected = previous.selected;
				}

				return {
					active: true,
					from,
					query,
					items,
					selected: Math.min(Math.max(selected, 0), items.length - 1),
					pending: action?.type === "pending" || (action?.type !== "open" && previous.pending),
					session,
					justInserted,
				};
			},
		},

		filterTransaction(tr, state) {
			// Starts a new undo step for the first edit after an insertion, so the
			// insertion stays alone in its step and one undo restores the typed text.
			if (slashMenuKey.getState(state)?.justInserted && tr.docChanged && !tr.getMeta(slashMenuKey)) {
				closeHistory(tr);
			}

			return true;
		},

		props: {
			handleTextInput(view, from, to, text) {
				const menu = slashMenuKey.getState(view.state);

				if (menu?.active) {
					// Nothing is typed while a command runs, so its trigger text stays put.
					if (!menu.pending) {
						view.dispatch(view.state.tr.insertText(text, from, to));
					}
					return true;
				}

				if (text !== "/" || view.composing || !canOpenAt(view.state, from, to)) {
					return false;
				}

				view.dispatch(view.state.tr.insertText(text, from, to).setMeta(slashMenuKey, { type: "open", from } satisfies SlashMenuAction));
				return true;
			},

			handleKeyDown(view, event) {
				const menu = slashMenuKey.getState(view.state);
				if (!menu?.active || event.ctrlKey || event.metaKey || event.altKey) {
					return false;
				}

				if (event.key === "Escape") {
					dispatchAction(view, { type: "close" });
					return true;
				}

				if (menu.pending) {
					return true;
				}

				const count = menu.items.length;
				switch (event.key) {
					case "ArrowDown":
						dispatchAction(view, { type: "select", index: (menu.selected + 1) % count });
						return true;
					case "ArrowUp":
						dispatchAction(view, { type: "select", index: (menu.selected - 1 + count) % count });
						return true;
					case "Enter":
					case "Tab":
						void runSlashMenuItem(view, menu.selected);
						return true;
					default:
						return false;
				}
			},

			handleDOMEvents: {
				// Leaving the editor dismisses the menu — except while a command runs,
				// since a command may itself move focus, to a file dialog for instance.
				blur(view) {
					const menu = slashMenuKey.getState(view.state);
					if (menu?.active && !menu.pending) {
						closeSlashMenu(view);
					}
					return false;
				},
			},
		},
	});
}

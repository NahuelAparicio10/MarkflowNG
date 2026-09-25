import type { EditorState } from "@tiptap/pm/state";
import type { SlashCommand } from "./types";

/**
 * The single declaration point for slash menu entries (design decision D2).
 * The menu renders whatever the registry holds, so a module contributes an
 * entry by registering it — the menu component is never edited for that.
 */
export interface SlashCommandRegistry {
	/** Adds `command`, or replaces the entry with its id. Returns a function that removes it. */
	register(command: SlashCommand): () => void;
	/** Every entry, in registration order. */
	list(): SlashCommand[];
}

export function createSlashCommandRegistry(): SlashCommandRegistry {
	// A Map keeps insertion order, and replacing an id keeps its position.
	const commands = new Map<string, SlashCommand>();

	return {
		register(command) {
			commands.set(command.id, command);

			return () => {
				if (commands.get(command.id) === command) {
					commands.delete(command.id);
				}
			};
		},

		list() {
			return [...commands.values()];
		},
	};
}

/** The registry every editor's slash menu reads from. */
export const slashCommands = createSlashCommandRegistry();

function matchesQuery(command: SlashCommand, query: string): boolean {
	if (query === "") {
		return true;
	}

	// Design decision D5: a fragment anywhere in the label, or the start of a keyword.
	return command.label.toLowerCase().includes(query) || command.keywords.some((keyword) => keyword.toLowerCase().startsWith(query));
}

/**
 * The entries the menu shows for `query` in `state`: available ones matching
 * the query, grouped into sections in the order each section was first
 * registered, and in registration order within a section. The order returned
 * is the order displayed, so an index into it is the keyboard selection.
 */
export function findSlashCommands(registry: SlashCommandRegistry, state: EditorState, query: string): SlashCommand[] {
	// A space straight after the slash means prose, not a filter.
	if (/^\s/.test(query)) {
		return [];
	}

	const normalized = query.toLowerCase();
	const all = registry.list();
	const groups = [...new Set(all.map((command) => command.group))];
	const matching = all.filter((command) => matchesQuery(command, normalized) && command.isAvailable(state));

	return groups.flatMap((group) => matching.filter((command) => command.group === group));
}

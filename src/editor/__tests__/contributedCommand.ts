import { slashCommands } from "../slashMenu/registry";

/**
 * Stands in for a module outside the slash menu — as `src/ai/` will be — that
 * contributes an entry by registering it, and nothing else. Registered on
 * import; `removeContributedCommand` takes it out again.
 */
export const CONTRIBUTED_COMMAND_ID = "test.contributed";

export const removeContributedCommand = slashCommands.register({
	id: CONTRIBUTED_COMMAND_ID,
	label: "Summarise section",
	keywords: ["contributed"],
	group: "AI",
	isAvailable: () => true,
	async run(context) {
		context.replaceTrigger((state, dispatch) => {
			dispatch?.(state.tr.insertText("contributed"));
			return true;
		});
	},
});

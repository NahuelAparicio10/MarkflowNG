import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Command } from "@tiptap/pm/state";
import { linkSelectionWithUrl } from "./links";

/**
 * Flips the checked state of the task item containing `pos`. Does nothing for
 * a plain list item: only a boolean `checked` is a task.
 */
export function toggleTaskItemAt(pos: number): Command {
	return (state, dispatch) => {
		const $pos = state.doc.resolve(pos);

		for (let depth = $pos.depth; depth > 0; depth--) {
			const node = $pos.node(depth);

			if (node.type !== state.schema.nodes.listItem) {
				continue;
			}
			if (typeof node.attrs.checked !== "boolean") {
				return false;
			}

			dispatch?.(state.tr.setNodeMarkup($pos.before(depth), null, { ...node.attrs, checked: !node.attrs.checked }));
			return true;
		}

		return false;
	};
}

/**
 * Behavior that is neither a shortcut nor an input rule: clicking a task
 * checkbox, and pasting a URL over a selection.
 */
export function createEditingBehaviorExtension() {
	return Extension.create({
		name: "markflowEditingBehavior",

		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: new PluginKey("markflowEditingBehavior"),
					props: {
						handleDOMEvents: {
							// mousedown rather than click: ProseMirror would otherwise move
							// the selection into the non-editable checkbox first.
							mousedown(view, event) {
								const target = event.target;
								if (!(target instanceof HTMLInputElement) || !target.closest(".markflow-task-checkbox")) {
									return false;
								}

								const content = target.closest("li")?.querySelector(".markflow-task-content");
								if (!content) {
									return false;
								}

								event.preventDefault();
								return toggleTaskItemAt(view.posAtDOM(content, 0))(view.state, view.dispatch);
							},
						},

						handlePaste(view, event) {
							const text = event.clipboardData?.getData("text/plain") ?? "";

							return linkSelectionWithUrl(text)(view.state, view.dispatch);
						},
					},
				}),
			];
		},
	});
}

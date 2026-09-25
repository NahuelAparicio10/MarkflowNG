import { closeHistory, undo } from "@tiptap/pm/history";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { MarkdownInputRule } from "./types";

interface InputRulesState {
	/** The last document change was a conversion. */
	justConverted: boolean;
}

export const inputRulesKey = new PluginKey<InputRulesState>("markflowInputRules");

interface Candidate {
	rule: MarkdownInputRule;
	match: RegExpExecArray;
}

/**
 * Runs Markdown input rules as the user types.
 *
 * A conversion reaches history in a fixed shape — see design decision D2:
 *
 * 1. The typed character is inserted as ordinary typing, so it joins the
 *    surrounding typing's undo step.
 * 2. The conversion is one transaction that starts its own undo step, and the
 *    next edit after it starts another.
 *
 * So one undo after a conversion shows exactly the literal syntax that was
 * typed, and a second undo removes the typing. Backspace immediately after a
 * conversion does the same as that first undo, the usual way to escape an
 * unwanted conversion.
 *
 * Rules never run inside code: in a code block, or with the caret in inline
 * code. `isEnabled` is the settings flag of design decision D3, read on every
 * keystroke.
 */
export function createInputRulesPlugin(rules: readonly MarkdownInputRule[], isEnabled: () => boolean) {
	function run(view: EditorView, from: number, to: number, text: string, onEnter: boolean): boolean {
		const { state } = view;

		if (!isEnabled() || view.composing || from !== to) {
			return false;
		}

		const $from = state.doc.resolve(from);
		if (!$from.parent.isTextblock || $from.parent.type.spec.code) {
			return false;
		}

		const marks = state.storedMarks ?? $from.marks();
		if (marks.some((mark) => mark.type.spec.code)) {
			return false;
		}

		const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼") + text;
		const candidates: Candidate[] = [];

		for (const rule of rules) {
			const match = !onEnter || rule.onEnter ? rule.pattern.exec(textBefore) : null;

			if (match) {
				candidates.push({ rule, match });
			}
		}

		if (candidates.length === 0) {
			return false;
		}

		// Enter's newline is never part of the document; typed text is.
		let caret = from;
		if (!onEnter) {
			view.dispatch(state.tr.insertText(text, from, to));
			caret = from + text.length;
		}

		for (const { rule, match } of candidates) {
			const matchedInDoc = match[0].length - (onEnter ? 1 : 0);
			const tr = rule.apply({ state: view.state, match, from: caret - matchedInDoc, to: caret });

			if (tr) {
				closeHistory(tr);
				tr.setMeta(inputRulesKey, true);
				view.dispatch(tr.scrollIntoView());
				return true;
			}
		}

		// The typed text is already in; for Enter, let the next handler act.
		return !onEnter;
	}

	return new Plugin<InputRulesState>({
		key: inputRulesKey,

		state: {
			init: () => ({ justConverted: false }),
			apply(tr, value) {
				if (tr.getMeta(inputRulesKey)) {
					return { justConverted: true };
				}

				return tr.docChanged ? { justConverted: false } : value;
			},
		},

		filterTransaction(tr, state) {
			// Starts a new undo step for the first edit after a conversion, so the
			// conversion stays alone in its step. Transactions are still mutable
			// here, before they are applied.
			if (inputRulesKey.getState(state)?.justConverted && tr.docChanged && !tr.getMeta(inputRulesKey)) {
				closeHistory(tr);
			}

			return true;
		},

		props: {
			handleTextInput(view, from, to, text) {
				return run(view, from, to, text, false);
			},

			handleKeyDown(view, event) {
				if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
					return false;
				}

				if (event.key === "Backspace" && inputRulesKey.getState(view.state)?.justConverted) {
					return undo(view.state, view.dispatch);
				}

				const { selection } = view.state;
				if (event.key === "Enter" && selection instanceof TextSelection && selection.$cursor) {
					return run(view, selection.$cursor.pos, selection.$cursor.pos, "\n", true);
				}

				return false;
			},
		},
	});
}

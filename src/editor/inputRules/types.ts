import type { EditorState, Transaction } from "@tiptap/pm/state";

export interface InputRuleContext {
	/** The state after the typed text was inserted. */
	state: EditorState;
	match: RegExpExecArray;
	/** Document position where the match starts. */
	from: number;
	/** Document position where the match ends: the caret, after the typed text. */
	to: number;
}

/**
 * Converts Markdown syntax typed into a textblock into the structure it stands
 * for. Rules only build the conversion; the plugin decides when they run and
 * how the conversion enters the undo history.
 */
export interface MarkdownInputRule {
	name: string;
	/**
	 * Tested against the textblock's text from its start up to the caret,
	 * including the text just typed. Block rules anchor with `^`.
	 */
	pattern: RegExp;
	/**
	 * Whether Enter also triggers the rule. The pattern is then tested with a
	 * `\n` appended, and the newline is never inserted.
	 */
	onEnter?: boolean;
	/** The conversion, or `null` when the rule does not apply here. */
	apply(context: InputRuleContext): Transaction | null;
}

import type { Node as PmNode } from "@tiptap/pm/model";
import { history } from "@tiptap/pm/history";
import { EditorState, type Plugin, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { mdastToPm, pmToMdast } from "../../core/mapping";
import { parseMarkdown, serializeMarkdown } from "../../core/markdown";
import { schema } from "../../core/schema";

/**
 * The part of an `EditorView` the editor's commands and plugins use: state,
 * dispatch and the IME flag. Enough to drive them without a DOM, which the
 * unit test environment does not have.
 */
export interface TestView {
	state: EditorState;
	composing: boolean;
	dispatch(tr: Transaction): void;
}

export function createTestView(doc: PmNode, plugins: Plugin[] = [], selectionAt?: number): TestView {
	const state = EditorState.create({ doc, plugins: [history(), ...plugins] });
	const view: TestView = {
		state: selectionAt === undefined ? state : state.apply(state.tr.setSelection(TextSelection.create(doc, selectionAt))),
		composing: false,
		dispatch(tr) {
			view.state = view.state.apply(tr);
		},
	};

	return view;
}

/** A document built from Markdown through the core, as the editor loads it. */
export function docFrom(markdown: string): PmNode {
	return mdastToPm(parseMarkdown(markdown));
}

/** The Markdown the editor would save for the current document. */
export function markdownOf(view: TestView): string {
	return serializeMarkdown(pmToMdast(view.state.doc));
}

export function emptyDoc(): PmNode {
	return schema.node("doc", null, [schema.node("paragraph")]);
}

/** Document position right after the first occurrence of `text`. */
export function positionAfter(doc: PmNode, text: string): number {
	let found = -1;

	doc.descendants((node, pos) => {
		if (found >= 0 || !node.isText) {
			return found < 0;
		}

		const index = node.text?.indexOf(text) ?? -1;
		if (index >= 0) {
			found = pos + index + text.length;
		}

		return false;
	});

	if (found < 0) {
		throw new Error(`Text not found in document: ${text}`);
	}

	return found;
}

/**
 * Types `text` one character at a time, giving `plugin` the first chance to
 * handle each one exactly as ProseMirror's input handling would, and inserting
 * the character as ordinary typing when it declines. Several plugins are
 * asked in order until one handles the character, as ProseMirror asks them.
 */
export function typeText(view: TestView, text: string, plugin?: Plugin | Plugin[]): void {
	const plugins = plugin === undefined ? [] : [plugin].flat();

	for (const char of text) {
		const { from, to } = view.state.selection;
		const insert = () => view.state.tr.insertText(char, from, to);
		const handled = plugins.some(
			(candidate) => candidate.props.handleTextInput?.call(candidate, view as unknown as EditorView, from, to, char, insert) ?? false,
		);

		if (!handled) {
			view.dispatch(insert());
		}
	}
}

/**
 * Presses a key through `plugin`'s key handler, or through each of several in
 * order until one handles it; returns whether it was handled.
 */
export function pressKey(view: TestView, key: string, plugin: Plugin | Plugin[]): boolean {
	const event = { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent;

	return [plugin].flat().some((candidate) => candidate.props.handleKeyDown?.call(candidate, view as unknown as EditorView, event) ?? false);
}

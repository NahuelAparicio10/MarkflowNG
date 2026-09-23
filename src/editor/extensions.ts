import { Mark, Node } from "@tiptap/core";
import type { MarkSpec, NodeSpec } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { marks, nodes } from "../core/schema";
import { createEditingBehaviorExtension } from "./editingBehavior";
import { createInputRulesExtension } from "./inputRules";
import { createShortcutsExtension } from "./shortcuts";

/**
 * D1: the editor's schema comes only from `src/core/schema/`. StarterKit is
 * kept installed only for its non-schema extensions — history/undo-redo —
 * so every node and mark extension it would otherwise register is disabled
 * here. It contributes no schema of its own.
 */
const history = StarterKit.configure({
	blockquote: false,
	bold: false,
	bulletList: false,
	code: false,
	codeBlock: false,
	document: false,
	dropcursor: false,
	gapcursor: false,
	hardBreak: false,
	heading: false,
	horizontalRule: false,
	italic: false,
	link: false,
	listItem: false,
	listKeymap: false,
	orderedList: false,
	paragraph: false,
	strike: false,
	text: false,
	underline: false,
	trailingNode: false,
});

/**
 * Mechanically adapts a core `NodeSpec` into a Tiptap node extension.
 *
 * Tiptap's `parseHTML`/`renderHTML` accept the same shapes ProseMirror's
 * `parseDOM`/`toDOM` do, so this is a translation, not a second schema:
 * content, group and DOM rules all come from `spec`, defined once in
 * `src/core/schema/nodes.ts`. See design decision D1.
 */
function createNodeExtension(name: string, spec: NodeSpec) {
	return Node.create({
		name,
		topNode: name === "doc" ? true : undefined,
		content: spec.content,
		group: spec.group,
		inline: spec.inline,
		atom: spec.atom,
		selectable: spec.selectable,
		defining: spec.defining,
		code: spec.code,
		marks: spec.marks,

		addAttributes() {
			return adaptAttributes(spec.attrs);
		},

		parseHTML() {
			return spec.parseDOM ?? [];
		},

		renderHTML({ node }) {
			return spec.toDOM ? spec.toDOM(node) : [name, 0];
		},
	});
}

/** The mark counterpart of `createNodeExtension`, under the same rule. */
function createMarkExtension(name: string, spec: MarkSpec) {
	return Mark.create({
		name,
		inclusive: spec.inclusive,
		excludes: spec.excludes,
		code: spec.code as boolean | undefined,

		addAttributes() {
			return adaptAttributes(spec.attrs);
		},

		parseHTML() {
			return spec.parseDOM ?? [];
		},

		renderHTML({ mark }) {
			return spec.toDOM ? spec.toDOM(mark, true) : [name, 0];
		},
	});
}

/**
 * Attribute defaults only. Parsing and rendering stay with the spec's own
 * `parseDOM`/`toDOM`; `rendered: false` stops Tiptap from also writing each
 * attribute onto the element under its own name.
 */
function adaptAttributes(attrs: NodeSpec["attrs"] | MarkSpec["attrs"]) {
	if (!attrs) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(attrs).map(([key, attr]) => [key, { default: attr.default, rendered: false }]),
	);
}

/**
 * The editor's full extension list: the core node and mark sets, one adapter
 * per type, history for undo/redo, and the behavior built on top of the
 * schema — shortcuts, list keys, input rules, task checkboxes and link paste.
 * No StarterKit node or mark is registered — see design decision D1 of
 * `openspec/changes/document-editor-base/design.md`.
 */
export function createExtensions(options: EditorBehaviorOptions) {
	return [
		history,
		...Object.entries(nodes).map(([name, spec]) => createNodeExtension(name, spec as NodeSpec)),
		...Object.entries(marks).map(([name, spec]) => createMarkExtension(name, spec)),
		createInputRulesExtension(options.isInputRulesEnabled),
		createShortcutsExtension(options.onOpenLink),
		createEditingBehaviorExtension(),
	];
}

export interface EditorBehaviorOptions {
	/** Read on every keystroke, so toggling the setting applies immediately. */
	isInputRulesEnabled(): boolean;
	/** Invoked by the link shortcut. The affordance itself lives in `src/ui/`. */
	onOpenLink(): void;
}

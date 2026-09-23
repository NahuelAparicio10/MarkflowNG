import { Node } from "@tiptap/core";
import type { NodeSpec } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { nodes } from "../core/schema";

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

		addAttributes() {
			if (!spec.attrs) {
				return {};
			}

			return Object.fromEntries(
				Object.entries(spec.attrs).map(([key, attr]) => [key, { default: attr.default }]),
			);
		},

		parseHTML() {
			return spec.parseDOM ?? [];
		},

		renderHTML({ node }) {
			return spec.toDOM ? spec.toDOM(node) : [name, 0];
		},
	});
}

/**
 * The editor's full extension list: the core node set, one adapter per node
 * type, plus history for undo/redo. No StarterKit node or mark is
 * registered — see design decision D1 of
 * `openspec/changes/document-editor-base/design.md`.
 */
export const extensions = [
	history,
	...Object.entries(nodes).map(([name, spec]) => createNodeExtension(name, spec as NodeSpec)),
];

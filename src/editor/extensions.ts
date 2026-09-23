import { Extension, Mark, Node, type NodeViewRendererProps } from "@tiptap/core";
import type { MarkSpec, NodeSpec } from "@tiptap/pm/model";
import { columnResizing, tableEditing } from "@tiptap/pm/tables";
import type { NodeView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { marks, nodes } from "../core/schema";
import { createEditingBehaviorExtension } from "./editingBehavior";
import { createImageInsertionPlugin, type ImageInsertionContext } from "./imageInsertion";
import { ImageView } from "./imageView";
import { createInputRulesExtension } from "./inputRules";
import { createShortcutsExtension } from "./shortcuts";
import { createTableAlignmentPlugin, createTableNormalizePlugin } from "./tables";

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
function createNodeExtension(name: string, spec: NodeSpec, nodeView?: NodeViewFactory) {
	return Node.create({
		name,
		topNode: name === "doc" ? true : undefined,
		content: spec.content,
		group: spec.group,
		inline: spec.inline,
		atom: spec.atom,
		selectable: spec.selectable,
		draggable: spec.draggable,
		defining: spec.defining,
		isolating: spec.isolating,
		code: spec.code,
		marks: spec.marks,

		addNodeView: nodeView ? () => nodeView : undefined,

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

type NodeViewFactory = (props: NodeViewRendererProps) => NodeView;

/**
 * Carries the node spec fields Tiptap has no named option for — only
 * `tableRole`, which `prosemirror-tables` reads to find the table, row and
 * cell types. Tiptap calls this once per node type, with that type's
 * extension, so it answers from the core spec of the same name.
 */
const coreSpecFields = Extension.create({
	name: "markflowCoreSpecFields",

	extendNodeSchema(extension) {
		const spec = nodes[extension.name as keyof typeof nodes] as NodeSpec | undefined;

		return spec?.tableRole ? { tableRole: spec.tableRole as string } : {};
	},
});

/**
 * Table behavior from `prosemirror-tables` (design decision D1): cell
 * selection, arrow keys across cells and column resizing, plus the plugins
 * that keep a table in the shape GFM can write and draw its alignment.
 * Column widths are view state: resizing writes `colwidth` on the cells,
 * which the mapping never reads, so it changes nothing on disk.
 */
const tables = Extension.create({
	name: "markflowTables",

	addProseMirrorPlugins() {
		return [
			columnResizing({ cellMinWidth: 48 }),
			tableEditing(),
			createTableNormalizePlugin(),
			createTableAlignmentPlugin(),
		];
	},
});

function createImagesExtension(context: ImageInsertionContext) {
	return Extension.create({
		name: "markflowImages",

		addProseMirrorPlugins() {
			return [createImageInsertionPlugin(context)];
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
 * schema — shortcuts, list keys, input rules, task checkboxes, link paste,
 * table editing and image insertion.
 * No StarterKit node or mark is registered — see design decision D1 of
 * `openspec/changes/document-editor-base/design.md`.
 */
export function createExtensions(options: EditorBehaviorOptions) {
	const nodeViews: Partial<Record<string, NodeViewFactory>> = {
		image: ({ node, view, getPos }) => new ImageView(node, view, getPos, options.images.getDocumentPath),
	};

	return [
		history,
		coreSpecFields,
		...Object.entries(nodes).map(([name, spec]) => createNodeExtension(name, spec as NodeSpec, nodeViews[name])),
		...Object.entries(marks).map(([name, spec]) => createMarkExtension(name, spec)),
		createInputRulesExtension(options.isInputRulesEnabled),
		createShortcutsExtension(options.onOpenLink),
		createEditingBehaviorExtension(),
		tables,
		createImagesExtension(options.images),
	];
}

export interface EditorBehaviorOptions {
	/** Read on every keystroke, so toggling the setting applies immediately. */
	isInputRulesEnabled(): boolean;
	/** Invoked by the link shortcut. The affordance itself lives in `src/ui/`. */
	onOpenLink(): void;
	/** The document and workspace images are resolved against and written beside. */
	images: ImageInsertionContext;
}

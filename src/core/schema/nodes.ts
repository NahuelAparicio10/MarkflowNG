import type { NodeSpec } from "@tiptap/pm/model";

/** Heading levels the schema admits, matching Markdown. */
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export type HeadingLevel = (typeof HEADING_LEVELS)[number];

function isHeadingLevel(value: unknown): value is HeadingLevel {
	return HEADING_LEVELS.includes(value as HeadingLevel);
}

const doc: NodeSpec = {
	content: "block+",
};

const paragraph: NodeSpec = {
	content: "inline*",
	group: "block",
	parseDOM: [{ tag: "p" }],
	toDOM() {
		return ["p", 0];
	},
};

const heading: NodeSpec = {
	attrs: {
		level: {
			default: 1,
			// ProseMirror does not validate attribute ranges on its own, so the
			// 1-6 constraint is enforced here. Without this a level of 7 would be
			// accepted and then serialize to something that is not a heading.
			validate(value: unknown) {
				if (!isHeadingLevel(value)) {
					throw new RangeError(`Invalid heading level: ${String(value)}`);
				}
			},
		},
	},
	content: "inline*",
	group: "block",
	defining: true,
	parseDOM: HEADING_LEVELS.map((level) => ({ tag: `h${level}`, attrs: { level } })),
	toDOM(node) {
		return [`h${node.attrs.level as HeadingLevel}`, 0];
	},
};

/**
 * One list type for both bulleted and numbered lists, matching mdast's single
 * `list` node with an `ordered` flag. Two ProseMirror types would each need to
 * map back to the same mdast type, which the one-to-one mapping registry
 * cannot express, and toggling a list's kind would become a node replacement
 * rather than an attribute change.
 */
const list: NodeSpec = {
	attrs: {
		ordered: { default: false },
		// The first number of an ordered list. `null` for bulleted lists, as in
		// mdast.
		start: { default: null },
		// Loose (blank lines between items) versus tight. Carried so that a
		// list keeps its form through a round-trip.
		spread: { default: false },
	},
	content: "listItem+",
	group: "block",
	parseDOM: [
		{ tag: "ul", attrs: { ordered: false, start: null } },
		{
			tag: "ol",
			getAttrs(dom) {
				const start = dom.getAttribute("start");
				return { ordered: true, start: start === null ? 1 : Number(start) };
			},
		},
	],
	toDOM(node) {
		if (node.attrs.ordered) {
			return ["ol", { start: node.attrs.start as number | null }, 0];
		}

		return ["ul", 0];
	},
};

/**
 * A task item is a list item whose `checked` is a boolean rather than `null`,
 * exactly as in mdast — see design decision D7. There is no task list type, so
 * a list can mix task items and plain items without the mapping having to
 * choose a list kind from its content.
 */
const listItem: NodeSpec = {
	attrs: {
		checked: { default: null },
		spread: { default: false },
	},
	content: "block+",
	defining: true,
	parseDOM: [
		{
			tag: "li",
			getAttrs(dom) {
				const checked = dom.getAttribute("data-checked");
				return { checked: checked === null ? null : checked === "true" };
			},
		},
	],
	toDOM(node) {
		if (typeof node.attrs.checked !== "boolean") {
			return ["li", 0];
		}

		// The content hole has to be the only child of its element, so the
		// checkbox and the item's content sit in separate wrappers.
		return [
			"li",
			{ class: "markflow-task-item", "data-checked": String(node.attrs.checked) },
			[
				"span",
				{ class: "markflow-task-checkbox", contenteditable: "false" },
				["input", node.attrs.checked ? { type: "checkbox", checked: "checked" } : { type: "checkbox" }],
			],
			["div", { class: "markflow-task-content" }, 0],
		];
	},
};

const blockquote: NodeSpec = {
	content: "block+",
	group: "block",
	defining: true,
	parseDOM: [{ tag: "blockquote" }],
	toDOM() {
		return ["blockquote", 0];
	},
};

/**
 * The language is a schema attribute mapping to the mdast `lang` field, not a
 * class name on the rendered element — see design decision D6. `meta` is the
 * rest of the fence's info string, carried so it is not lost on save.
 */
const codeBlock: NodeSpec = {
	attrs: {
		language: { default: null },
		meta: { default: null },
	},
	content: "text*",
	marks: "",
	group: "block",
	code: true,
	defining: true,
	parseDOM: [
		{
			tag: "pre",
			preserveWhitespace: "full",
			getAttrs(dom) {
				return { language: dom.getAttribute("data-language") };
			},
		},
	],
	toDOM(node) {
		return ["pre", { "data-language": node.attrs.language as string | null }, ["code", 0]];
	},
};

const thematicBreak: NodeSpec = {
	group: "block",
	parseDOM: [{ tag: "hr" }],
	toDOM() {
		return ["hr"];
	},
};

const text: NodeSpec = {
	group: "inline",
};

/**
 * Carries an mdast subtree the schema does not model, so that opening and
 * saving a document never destroys content.
 *
 * There are two of these rather than one because ProseMirror's block/inline
 * distinction is a property of the node type: a node cannot be both, so an
 * unsupported table and an unsupported emphasis span cannot share a type. They
 * behave identically otherwise.
 */
const preserved: NodeSpec = {
	attrs: { mdast: {} },
	group: "block",
	atom: true,
	selectable: true,
	// Rendered inert. The reader draws these properly; in the editor they are
	// visible, unmodifiable placeholders until their type becomes supported.
	toDOM() {
		return ["div", { class: "markflow-preserved", contenteditable: "false" }];
	},
};

const preservedInline: NodeSpec = {
	attrs: { mdast: {} },
	inline: true,
	group: "inline",
	atom: true,
	selectable: true,
	toDOM() {
		return ["span", { class: "markflow-preserved-inline", contenteditable: "false" }];
	},
};

/**
 * The node set the round-trip is closed over. Anything not modelled here —
 * tables, images and frontmatter, until a later change — travels through a
 * preservation node instead of being dropped.
 *
 * `paragraph` must stay the first block type: ProseMirror fills required block
 * content with the first type in the group.
 */
export const nodes = {
	doc,
	paragraph,
	heading,
	list,
	listItem,
	blockquote,
	codeBlock,
	thematicBreak,
	text,
	preserved,
	preservedInline,
};

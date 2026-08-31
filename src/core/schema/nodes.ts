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
 * The node set this change closes the round-trip over. Marks and the remaining
 * block types are registered by later changes; anything not modelled here
 * travels through a preservation node instead of being dropped.
 */
export const nodes = { doc, paragraph, heading, text, preserved, preservedInline };

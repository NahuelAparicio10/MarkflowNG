import type { MarkSpec } from "@tiptap/pm/model";

const UNSAFE_URL_PATTERN = /^\s*javascript:/i;

/**
 * The href actually written to the DOM. The target itself is kept verbatim in
 * the mark's attributes, so it round-trips; only the rendered element is
 * defused, since a `javascript:` link must not run script inside a webview
 * that has Tauri IPC access. Mirrors `safeUrl` in the reader.
 */
function renderedHref(href: unknown): string | null {
	if (typeof href !== "string" || UNSAFE_URL_PATTERN.test(href)) {
		return null;
	}

	return href;
}

/**
 * Declared first so it ranks outermost. Mark rank is ProseMirror's only notion
 * of nesting order, and it decides how marks covering exactly the same span are
 * nested when the document is converted back to mdast.
 */
const link: MarkSpec = {
	attrs: {
		href: { default: "" },
		// `null` rather than absent, matching what remark produces for a link
		// with no title, so the round-trip compares equal.
		title: { default: null },
	},
	// Typing at the end of a link must not extend it.
	inclusive: false,
	parseDOM: [
		{
			tag: "a[href]",
			getAttrs(dom) {
				return { href: dom.getAttribute("href") ?? "", title: dom.getAttribute("title") };
			},
		},
	],
	toDOM(mark) {
		return ["a", { href: renderedHref(mark.attrs.href), title: mark.attrs.title as string | null }, 0];
	},
};

/**
 * Ranked before `strong` because remark parses `***text***` as emphasis
 * wrapping strong. With the opposite rank, that common form would come back
 * from the editor nested the other way round.
 */
const emphasis: MarkSpec = {
	parseDOM: [{ tag: "em" }, { tag: "i" }],
	toDOM() {
		return ["em", 0];
	},
};

const strong: MarkSpec = {
	parseDOM: [{ tag: "strong" }, { tag: "b" }],
	toDOM() {
		return ["strong", 0];
	},
};

const strikethrough: MarkSpec = {
	parseDOM: [{ tag: "del" }, { tag: "s" }],
	toDOM() {
		return ["del", 0];
	},
};

/**
 * Ranked last, so it is always innermost: an mdast `inlineCode` is a leaf with a
 * literal value and cannot contain other formatting.
 *
 * `code: true` is what the mapping and the input rules read to treat the span
 * as literal text.
 */
const inlineCode: MarkSpec = {
	code: true,
	parseDOM: [{ tag: "code" }],
	toDOM() {
		return ["code", 0];
	},
};

/** The mark set, in rank order. See the notes on `link` and `emphasis`. */
export const marks = { link, emphasis, strong, strikethrough, inlineCode };

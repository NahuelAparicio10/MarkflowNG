/**
 * The fixture corpus, and which fixtures are in the serializer normal form.
 *
 * The distinction matters because the two round-trip invariants are not the
 * same claim. The text invariant only holds for documents already written the
 * way the serializer writes them; asserting it over a document with unusual but
 * valid formatting would fail for a benign reason and hide real mapping bugs.
 * The structural invariant holds for everything.
 */
export interface Fixture {
	/** Path relative to this directory. */
	path: string;
	/** Whether `serialize(parse(source)) === source` is expected to hold. */
	normalized: boolean;
	/** Why this fixture exists, so a failure says what broke. */
	covers: string;
	/**
	 * Set, with the reason, when remark's own serializer changes this
	 * document's structure — a ragged table row comes back padded even
	 * without the editor involved. The structural invariant is then measured
	 * against remark's own round trip rather than the first parse: the
	 * mapping must lose nothing beyond what serialization alone already
	 * changes. Every such fixture has a dedicated test asserting the
	 * normalized result, so the change is deliberate rather than incidental.
	 */
	serializerNormalizes?: string;
}

export const FIXTURES: readonly Fixture[] = [
	{
		path: "edge/empty.md",
		normalized: true,
		covers: "an empty document, which parses to a root with no children",
	},
	{
		path: "edge/empty-heading.md",
		normalized: true,
		covers: "a heading with no text content",
	},
	{
		path: "edge/consecutive-paragraphs.md",
		normalized: true,
		covers: "consecutive paragraphs, where block separation must be preserved",
	},
	{
		path: "edge/all-heading-levels.md",
		normalized: true,
		covers: "every heading level from 1 to 6",
	},
	{
		path: "edge/headings-and-paragraphs.md",
		normalized: true,
		covers: "the ordinary mix of headings and body text",
	},
	{
		path: "edge/no-headings.md",
		normalized: true,
		covers: "a document with no headings at all",
	},
	{
		path: "edge/trailing-blank-lines.md",
		normalized: false,
		covers: "trailing blank lines at end of file, which the serializer drops",
	},
	{
		path: "edge/non-normal-form.md",
		normalized: false,
		covers: "valid Markdown written in a different form than the serializer emits",
	},
	{
		path: "marks/strong.md",
		normalized: true,
		covers: "strong text mid-paragraph and at the end of a paragraph",
	},
	{
		path: "marks/emphasis.md",
		normalized: true,
		covers: "emphasis mid-paragraph and spanning a whole paragraph",
	},
	{
		path: "marks/strikethrough.md",
		normalized: true,
		covers: "GFM strikethrough, which mdast calls delete",
	},
	{
		path: "marks/inline-code.md",
		normalized: true,
		covers: "inline code, including a backtick inside the code",
	},
	{
		path: "marks/links.md",
		normalized: true,
		covers: "links with and without a title, and an autolink",
	},
	{
		path: "marks/overlapping.md",
		normalized: true,
		covers: "overlapping and nested marks, including code and links inside other marks",
	},
	{
		path: "blocks/nested-lists.md",
		normalized: true,
		covers: "bulleted lists nested three levels deep",
	},
	{
		path: "blocks/mixed-lists.md",
		normalized: true,
		covers: "ordered and bulleted lists nested in each other, and an ordered list not starting at 1",
	},
	{
		path: "blocks/loose-and-tight-lists.md",
		normalized: true,
		covers: "tight and loose lists, which differ only in blank lines between items",
	},
	{
		path: "blocks/task-lists.md",
		normalized: true,
		covers: "checked, unchecked and plain items in one list, and task items in a nested list",
	},
	{
		path: "blocks/blockquotes.md",
		normalized: true,
		covers: "a quote containing a heading, several paragraphs and a nested quote",
	},
	{
		path: "blocks/code-blocks.md",
		normalized: true,
		covers: "code blocks with and without a language, with a meta string, with Markdown inside, and empty",
	},
	{
		path: "blocks/thematic-breaks.md",
		normalized: true,
		covers: "thematic breaks between paragraphs and at the end of a document",
	},
	{
		path: "tables/empty-cells.md",
		normalized: true,
		covers: "empty cells, including a wholly empty row",
	},
	{
		path: "tables/inline-content.md",
		normalized: true,
		covers: "cells containing marks, overlapping marks, code, links with titles and an image",
	},
	{
		path: "tables/single-column.md",
		normalized: true,
		covers: "a single-column table",
	},
	{
		path: "tables/single-row.md",
		normalized: true,
		covers: "a table with a header row and no body rows",
	},
	{
		path: "tables/alignment.md",
		normalized: true,
		covers: "left, centre, right and default alignment, together and in single-column tables",
	},
	{
		path: "tables/pipes-and-escapes.md",
		normalized: true,
		covers: "escaped pipes in text and in code, escaped emphasis and brackets, and a literal backslash",
	},
	{
		path: "tables/compact.md",
		normalized: false,
		covers: "a hand-written table with no padding and uneven spacing",
	},
	{
		path: "tables/ragged-rows.md",
		normalized: false,
		covers: "rows shorter than the header, which are padded with empty cells on load",
		serializerNormalizes: "remark-stringify pads short table rows with empty cells",
	},
	{
		path: "images/relative-paths.md",
		normalized: true,
		covers: "relative image paths: sibling, subfolder, parent, dot-slash and one containing spaces",
	},
	{
		path: "images/absolute-urls.md",
		normalized: true,
		covers: "absolute image URLs, one with a query string, one inline in text, and a linked image",
	},
	{
		path: "images/alt-text.md",
		normalized: true,
		covers: "images with and without alt text, and two images in one paragraph",
	},
	{
		path: "images/titles.md",
		normalized: true,
		covers: "titles written by another tool, near-misses of the size encoding, and encoded sizes",
	},
	{
		path: "real/readme.md",
		normalized: false,
		covers: "a real document from this repository",
	},
	{
		path: "real/architecture.md",
		normalized: false,
		covers: "a real document with tables, code blocks and nested structure",
	},
	{
		path: "real/explore.md",
		normalized: false,
		covers: "the largest real document available, with tables, code fences and lists",
	},
];

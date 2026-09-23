import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mdastToPm } from "../../core/mapping";
import { parseMarkdown } from "../../core/markdown";
import { FIXTURES } from "../../core/fixtures/manifest";
import { renderMdast } from "../../reader/renderMdast";
import { readFixture } from "../../core/__tests__/helpers";

/**
 * Fixtures containing only node types the editor schema models: text blocks,
 * marks, lists and task items, quotes, code blocks, rules, tables and images.
 * `blocks/mixed-lists.md` is left out because it separates two lists with an
 * HTML comment, which the reader shows as raw text and the editor as a
 * preserved placeholder — the fallback, not a schema gap.
 */
const SUPPORTED_FIXTURE_PATHS = new Set([
	"edge/empty.md",
	"edge/empty-heading.md",
	"edge/consecutive-paragraphs.md",
	"edge/all-heading-levels.md",
	"edge/headings-and-paragraphs.md",
	"edge/no-headings.md",
	"edge/trailing-blank-lines.md",
	"edge/non-normal-form.md",
	"marks/strong.md",
	"marks/emphasis.md",
	"marks/strikethrough.md",
	"marks/inline-code.md",
	"marks/links.md",
	"marks/overlapping.md",
	"blocks/nested-lists.md",
	"blocks/loose-and-tight-lists.md",
	"blocks/task-lists.md",
	"blocks/blockquotes.md",
	"blocks/code-blocks.md",
	"blocks/thematic-breaks.md",
	"tables/empty-cells.md",
	"tables/inline-content.md",
	"tables/single-column.md",
	"tables/single-row.md",
	"tables/alignment.md",
	"tables/pipes-and-escapes.md",
	"tables/compact.md",
	"tables/ragged-rows.md",
	"images/relative-paths.md",
	"images/absolute-urls.md",
	"images/alt-text.md",
	"images/titles.md",
	"real/readme.md",
	"real/architecture.md",
	"real/explore.md",
]);

const supportedFixtures = FIXTURES.filter((fixture) => SUPPORTED_FIXTURE_PATHS.has(fixture.path));

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

/**
 * Inline elements join the text around them without a gap, as they do on
 * screen; every other element boundary separates text, as blocks do.
 */
const INLINE_TAG = /<\/?(?:a|strong|em|del|code|span|input)(?=[\s>/])[^>]*>/g;

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'" };

function readerText(source: string): string {
	const tree = parseMarkdown(source);
	const html = renderToStaticMarkup(<>{renderMdast(tree)}</>);
	const text = html
		.replace(INLINE_TAG, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ENTITIES[entity]);
	return normalizeWhitespace(text);
}

function editorText(source: string): string {
	const doc = mdastToPm(parseMarkdown(source));
	return normalizeWhitespace(doc.textBetween(0, doc.content.size, " ", " "));
}

describe("reader and editor render fixtures with equivalent text content", () => {
	it("covers the fixtures within this phase's schema", () => {
		expect(supportedFixtures.length).toBe(SUPPORTED_FIXTURE_PATHS.size);
	});

	it.each(supportedFixtures.map((fixture) => [fixture.path, fixture] as const))(
		"%s",
		(_path, fixture) => {
			const source = readFixture(fixture);

			expect(editorText(source)).toBe(readerText(source));
		},
	);
});

function count(pattern: RegExp, text: string): number {
	return (text.match(pattern) ?? []).length;
}

/**
 * Text parity cannot see an image, which has no text, or tell a dropped empty
 * cell from whitespace. These count them in both modes instead.
 */
describe("reader and editor render the same images and table cells", () => {
	it.each(supportedFixtures.map((fixture) => [fixture.path, fixture] as const))("%s", (_path, fixture) => {
		const source = readFixture(fixture);
		const html = renderToStaticMarkup(<>{renderMdast(parseMarkdown(source))}</>);
		const doc = mdastToPm(parseMarkdown(source));
		const editorCounts = { images: 0, headerCells: 0, cells: 0 };

		doc.descendants((node) => {
			if (node.type.name === "image") editorCounts.images++;
			if (node.type.name === "tableHeader") editorCounts.headerCells++;
			if (node.type.name === "tableCell") editorCounts.cells++;
		});

		expect({
			images: count(/<img[\s>]/g, html),
			headerCells: count(/<th[\s>]/g, html),
			cells: count(/<td[\s>]/g, html),
		}).toEqual(editorCounts);
	});
});

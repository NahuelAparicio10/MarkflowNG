import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mdastToPm } from "../../core/mapping";
import { parseMarkdown } from "../../core/markdown";
import { FIXTURES } from "../../core/fixtures/manifest";
import { renderMdast } from "../../reader/renderMdast";
import { readFixture } from "../../core/__tests__/helpers";

/**
 * Fixtures containing only node types the editor schema models: text blocks,
 * marks, lists and task items, quotes, code blocks and rules. `real/*`
 * fixtures still contain tables and images, which travel through the
 * `preserved` node, so they are out of scope until a later change adds
 * handlers for them — see the "Parity test grows with the schema" spec
 * scenario. `blocks/mixed-lists.md` is left out for the same reason: it
 * separates two lists with an HTML comment, which the reader shows as raw
 * text and the editor as a preserved placeholder.
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

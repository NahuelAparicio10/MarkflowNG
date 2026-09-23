import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mdastToPm } from "../../core/mapping";
import { parseMarkdown } from "../../core/markdown";
import { FIXTURES } from "../../core/fixtures/manifest";
import { renderMdast } from "../../reader/renderMdast";
import { readFixture } from "../../core/__tests__/helpers";

/**
 * Fixtures containing only node types this phase's editor schema models
 * (paragraph, heading, text). `real/*` fixtures and `non-normal-form.md`
 * (a list) exercise node types that still travel through the `preserved`
 * node here, so they are out of scope until a later change adds handlers
 * for them — see the "Parity test grows with the schema" spec scenario.
 */
const SUPPORTED_FIXTURE_PATHS = new Set([
	"edge/empty.md",
	"edge/empty-heading.md",
	"edge/consecutive-paragraphs.md",
	"edge/all-heading-levels.md",
	"edge/headings-and-paragraphs.md",
	"edge/no-headings.md",
	"edge/trailing-blank-lines.md",
]);

const supportedFixtures = FIXTURES.filter((fixture) => SUPPORTED_FIXTURE_PATHS.has(fixture.path));

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function readerText(source: string): string {
	const tree = parseMarkdown(source);
	const html = renderToStaticMarkup(<>{renderMdast(tree)}</>);
	return normalizeWhitespace(html.replace(/<[^>]+>/g, " "));
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

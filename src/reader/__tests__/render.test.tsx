import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { renderMdast } from "../renderMdast";

function renderSource(source: string): string {
	const tree = parseMarkdown(source);
	return renderToStaticMarkup(<>{renderMdast(tree)}</>);
}

describe("renderMdast", () => {
	it("renders headings at their level with no Markdown syntax visible", () => {
		const html = renderSource("# Title\n\n## Subtitle\n");

		expect(html).toContain("<h1");
		expect(html).toContain(">Title</h1>");
		expect(html).toContain("<h2");
		expect(html).toContain(">Subtitle</h2>");
		expect(html).not.toMatch(/[#]/);
	});

	it("renders paragraphs as body text", () => {
		const html = renderSource("Body text.\n");

		expect(html).toContain("<p>Body text.</p>");
	});

	it("renders a GFM table as a table, not an inert placeholder", () => {
		const html = renderSource("| a | b |\n| - | - |\n| 1 | 2 |\n");

		expect(html).toContain("<table");
		expect(html).toContain("<th>a</th>");
		expect(html).toContain("<td>1</td>");
		expect(html).not.toContain("markflow-preserved");
	});

	it("renders a fenced code block as preformatted text", () => {
		const html = renderSource("```ts\nconst x = 1;\n```\n");

		expect(html).toContain("<pre");
		expect(html).toContain("language-ts");
		expect(html).toContain("const x = 1;");
	});

	it("renders an image by absolute URL directly", () => {
		const html = renderSource("![alt text](https://example.com/image.png)\n");

		expect(html).toContain("<img");
		expect(html).toContain('src="https://example.com/image.png"');
		expect(html).toContain('alt="alt text"');
	});

	it("never writes a relative reference into src, which would resolve against the app", () => {
		const html = renderSource("![alt text](./image.png)\n");

		expect(html).toContain("<img");
		expect(html).toContain('alt="alt text"');
		expect(html).not.toContain("./image.png");
	});

	it("shows an image at its encoded width, without the encoding in the tooltip", () => {
		const html = renderSource('![a](https://example.com/a.png "Arena | width=320")\n');

		expect(html).toContain('width="320"');
		expect(html).toContain('title="Arena"');
		expect(html).not.toContain("width=320");
	});

	it("does not load an image with a javascript: reference", () => {
		const html = renderSource("![x](javascript:alert(1))\n");

		expect(html).not.toContain("javascript:");
	});

	it("pads a ragged table row to the widest row, as the editor does", () => {
		const html = renderSource("| a | b |\n| - | - |\n| 1 |\n");

		expect(html).toContain("<td>1</td><td></td>");
	});

	it("renders a task list as checkboxes", () => {
		const html = renderSource("- [x] Done\n- [ ] Not done\n");

		const checkboxCount = (html.match(/type="checkbox"/g) ?? []).length;
		expect(checkboxCount).toBe(2);
		expect(html).toContain("checked");
		expect(html).toContain("disabled");
	});

	it("is pure: rendering does not mutate the tree, and the same tree renders equivalently twice", () => {
		const tree = parseMarkdown("# Title\n\nBody with *emphasis* and a [link](https://example.com).\n");
		const before = JSON.stringify(tree);

		const first = renderToStaticMarkup(<>{renderMdast(tree)}</>);
		const second = renderToStaticMarkup(<>{renderMdast(tree)}</>);

		expect(JSON.stringify(tree)).toBe(before);
		expect(first).toBe(second);
	});

	it("renders no editing affordances", () => {
		const html = renderSource("# Title\n\nBody text.\n");

		expect(html).not.toContain("contenteditable");
		expect(html).not.toMatch(/<input(?![^>]*type="checkbox")/);
	});
});

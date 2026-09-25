import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { renderMdast } from "../../reader/renderMdast";
import { PreviewContent } from "../Preview";

const previewSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "Preview.tsx"), "utf8");
const readerSource = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "..", "..", "reader", "ReaderView.tsx"),
	"utf8",
);

const SAMPLE = "# Combat\n\nParry within **six frames**.\n\n- [x] Light attack\n- [ ] Heavy attack\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";

describe("document preview", () => {
	it("renders formatted content", () => {
		const html = renderToStaticMarkup(<PreviewContent tree={parseMarkdown(SAMPLE)} />);

		expect(html).toContain(">Combat</h1>");
		expect(html).toContain("<strong>six frames</strong>");
		expect(html).toContain("<table");
		expect(html).not.toContain("**");
	});

	it("produces exactly the reader's output for the same document", () => {
		const tree = parseMarkdown(SAMPLE);

		const preview = renderToStaticMarkup(<PreviewContent tree={tree} />);
		const reader = renderToStaticMarkup(<div className="markflow-prose markflow-reader">{renderMdast(tree)}</div>);

		expect(preview).toBe(reader);
	});

	it("calls the same renderer reader mode uses, and no other", () => {
		const importsRenderer = /import \{ renderMdast \} from "\.\.\/reader\/renderMdast";/;

		expect(previewSource).toMatch(importsRenderer);
		expect(readerSource).toMatch(/import \{ renderMdast \} from "\.\/renderMdast";/);
		expect(previewSource).not.toMatch(/renderNode|dangerouslySetInnerHTML/);
	});

	it("creates no editor instance", () => {
		expect(previewSource).not.toMatch(/@tiptap|prosemirror|useEditor|EditorView|contenteditable/i);

		const html = renderToStaticMarkup(<PreviewContent tree={parseMarkdown(SAMPLE)} />);
		expect(html).not.toMatch(/contenteditable|ProseMirror/);
	});
});

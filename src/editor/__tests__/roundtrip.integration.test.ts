import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeMarkdown } from "../../core/markdown";
import { parseMarkdown } from "../../core/markdown";
import { FIXTURES, type Fixture } from "../../core/fixtures/manifest";

vi.mock("@tauri-apps/plugin-fs", async () => {
	const fs = await import("node:fs/promises");
	return {
		readTextFile: (path: string) => fs.readFile(path, "utf8"),
		writeTextFile: (path: string, data: string) => fs.writeFile(path, data, "utf8"),
		rename: (from: string, to: string) => fs.rename(from, to),
		remove: (path: string) =>
			fs.rm(path, { force: true }).catch(() => {
				// Best-effort cleanup, mirroring the real plugin's shape.
			}),
	};
});

const fixturesDir = join(__dirname, "..", "..", "core", "fixtures");

function readFixture(fixture: Fixture): string {
	return readFileSync(join(fixturesDir, fixture.path), "utf8");
}

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "markflow-editor-"));
});

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true });
});

describe("byte-identical round trip on disk", () => {
	const normalizedFixtures = FIXTURES.filter((fixture) => fixture.normalized);

	it.each(normalizedFixtures.map((fixture) => [fixture.path, fixture] as const))(
		"opens and saves %s without editing, leaving the bytes unchanged",
		async (_path, fixture) => {
			const { loadDocument } = await import("../loadDocument");
			const { saveDocument } = await import("../saveDocument");

			const source = readFixture(fixture);
			const filePath = join(tempDir, "document.md");
			writeFileSync(filePath, source, "utf8");

			const doc = await loadDocument(filePath);
			await saveDocument(filePath, doc);

			expect(readFileSync(filePath, "utf8")).toBe(source);
		},
	);

	it("round-trips a full real-world document unchanged once it is in normal form", async () => {
		const { loadDocument } = await import("../loadDocument");
		const { saveDocument } = await import("../saveDocument");

		const source = readFixture(FIXTURES.find((f) => f.path === "real/explore.md")!);
		const normalized = serializeMarkdown(parseMarkdown(source));
		const filePath = join(tempDir, "explore.md");
		writeFileSync(filePath, normalized, "utf8");

		const doc = await loadDocument(filePath);
		await saveDocument(filePath, doc);

		expect(readFileSync(filePath, "utf8")).toBe(normalized);
	});
});

describe("content beyond the editable schema survives a save", () => {
	it("keeps frontmatter, a table and a code block intact when an unrelated paragraph is edited", async () => {
		const { loadDocument } = await import("../loadDocument");
		const { saveDocument } = await import("../saveDocument");

		const source = [
			"---",
			"title: Test document",
			"---",
			"",
			"# Heading",
			"",
			"Body paragraph.",
			"",
			"| A | B |",
			"| --- | --- |",
			"| 1 | 2 |",
			"",
			"```js",
			'console.log("hi");',
			"```",
			"",
		].join("\n");

		const filePath = join(tempDir, "mixed.md");
		writeFileSync(filePath, source, "utf8");

		const doc = await loadDocument(filePath);

		// Simulate an edit to the one paragraph the schema models, without a
		// real DOM-backed editor: rebuild the doc from JSON with that node's
		// text changed, exactly as ProseMirror would after a keystroke.
		const json = doc.toJSON() as { content: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> };
		const paragraphNode = json.content.find((node) => node.type === "paragraph")!;
		paragraphNode.content![0].text = "Body paragraph, edited.";
		const editedDoc = doc.type.schema.nodeFromJSON(json);

		await saveDocument(filePath, editedDoc);

		const after = readFileSync(filePath, "utf8");
		expect(after).toContain("title: Test document");
		expect(after).toContain("| A | B |");
		expect(after).toContain('console.log("hi");');
		expect(after).toContain("Body paragraph, edited.");
	});
});

describe("atomic write", () => {
	it("leaves the original file intact when the write fails partway", async () => {
		vi.resetModules();
		vi.doMock("@tauri-apps/plugin-fs", async () => {
			const fs = await import("node:fs/promises");
			return {
				readTextFile: (path: string) => fs.readFile(path, "utf8"),
				writeTextFile: () => {
					throw new Error("simulated disk failure");
				},
				rename: (from: string, to: string) => fs.rename(from, to),
				remove: (path: string) => fs.rm(path, { force: true }).catch(() => {}),
			};
		});

		const { loadDocument } = await import("../loadDocument");
		const { saveDocument } = await import("../saveDocument");

		const original = "# Title\n\nOriginal body.\n";
		const filePath = join(tempDir, "document.md");
		writeFileSync(filePath, original, "utf8");

		const doc = await loadDocument(filePath);

		await expect(saveDocument(filePath, doc)).rejects.toThrow("simulated disk failure");
		expect(readFileSync(filePath, "utf8")).toBe(original);

		vi.doUnmock("@tauri-apps/plugin-fs");
		vi.resetModules();
	});
});

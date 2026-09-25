import { describe, expect, it, vi } from "vitest";

const readTextFileMock = vi.fn();

vi.mock("@tauri-apps/plugin-fs", () => ({
	readTextFile: (...args: unknown[]) => readTextFileMock(...args),
	writeTextFile: vi.fn(),
	rename: vi.fn(),
	remove: vi.fn(),
}));

describe("loadDocument", () => {
	it("reads the file, then goes through parseMarkdown and mdastToPm to build the document", async () => {
		const { loadDocument } = await import("../loadDocument");

		readTextFileMock.mockResolvedValueOnce("# Title\n\nBody.\n");

		const doc = await loadDocument("/docs/example.md");

		expect(readTextFileMock).toHaveBeenCalledWith("/docs/example.md");
		expect(doc.type.name).toBe("doc");
		expect(doc.textBetween(0, doc.content.size, "\n\n")).toBe("Title\n\nBody.");
	});

	it("maps an empty file to a document with a single empty paragraph", async () => {
		const { loadDocument } = await import("../loadDocument");

		readTextFileMock.mockResolvedValueOnce("");

		const doc = await loadDocument("/docs/empty.md");

		expect(doc.childCount).toBe(1);
		expect(doc.firstChild?.type.name).toBe("paragraph");
	});

	it("propagates a read failure without constructing a document", async () => {
		const { loadDocument } = await import("../loadDocument");

		readTextFileMock.mockRejectedValueOnce(new Error("not found"));

		await expect(loadDocument("/docs/missing.md")).rejects.toThrow("not found");
	});
});

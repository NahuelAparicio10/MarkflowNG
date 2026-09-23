import { beforeEach, describe, expect, it, vi } from "vitest";
import { mdastToPm } from "../../core/mapping";
import { parseMarkdown } from "../../core/markdown";

const writeTextFileMock = vi.fn();
const renameMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@tauri-apps/plugin-fs", () => ({
	readTextFile: vi.fn(),
	writeTextFile: (...args: unknown[]) => writeTextFileMock(...args),
	rename: (...args: unknown[]) => renameMock(...args),
	remove: (...args: unknown[]) => removeMock(...args),
}));

describe("saveDocument", () => {
	beforeEach(() => {
		writeTextFileMock.mockReset();
		renameMock.mockReset();
		removeMock.mockReset();
	});

	it("writes to a temp file in the same directory, then renames it over the target", async () => {
		const { saveDocument } = await import("../saveDocument");
		writeTextFileMock.mockResolvedValueOnce(undefined);
		renameMock.mockResolvedValueOnce(undefined);

		const doc = mdastToPm(parseMarkdown("# Title\n\nBody.\n"));
		const text = await saveDocument("/docs/example.md", doc);

		expect(text).toBe("# Title\n\nBody.\n");
		expect(writeTextFileMock).toHaveBeenCalledWith("/docs/example.md.markflow-tmp", text);
		expect(renameMock).toHaveBeenCalledWith("/docs/example.md.markflow-tmp", "/docs/example.md");
	});

	it("cleans up the temp file and rethrows when the write fails", async () => {
		const { saveDocument } = await import("../saveDocument");
		writeTextFileMock.mockRejectedValueOnce(new Error("disk full"));
		removeMock.mockResolvedValueOnce(undefined);

		const doc = mdastToPm(parseMarkdown("# Title\n"));

		await expect(saveDocument("/docs/example.md", doc)).rejects.toThrow("disk full");
		expect(renameMock).not.toHaveBeenCalled();
		expect(removeMock).toHaveBeenCalledWith("/docs/example.md.markflow-tmp");
	});

	it("cleans up the temp file and rethrows when the rename fails", async () => {
		const { saveDocument } = await import("../saveDocument");
		writeTextFileMock.mockResolvedValueOnce(undefined);
		renameMock.mockRejectedValueOnce(new Error("rename failed"));
		removeMock.mockResolvedValueOnce(undefined);

		const doc = mdastToPm(parseMarkdown("# Title\n"));

		await expect(saveDocument("/docs/example.md", doc)).rejects.toThrow("rename failed");
		expect(removeMock).toHaveBeenCalledWith("/docs/example.md.markflow-tmp");
	});

	it("writes nothing when serialization fails", async () => {
		vi.resetModules();
		vi.doMock("../documentText", () => ({
			serializeDoc: () => {
				throw new Error("serialization exploded");
			},
		}));

		const { saveDocument } = await import("../saveDocument");
		const doc = mdastToPm(parseMarkdown("# Title\n"));

		await expect(saveDocument("/docs/example.md", doc)).rejects.toThrow("serialization exploded");
		expect(writeTextFileMock).not.toHaveBeenCalled();
		expect(renameMock).not.toHaveBeenCalled();

		vi.doUnmock("../documentText");
	});
});

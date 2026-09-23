import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { useSessionStore } from "../../store/session";
import { closeTab } from "../closeTab";

const paths = () => useSessionStore.getState().documents.map((document) => document.path);

describe("closing a tab", () => {
	beforeEach(() => {
		useSessionStore.setState({ documents: [], activePath: null, error: null });
		useSessionStore.getState().openDocument("/docs/clean.md", parseMarkdown("# Clean\n"));
		useSessionStore.getState().openDocument("/docs/dirty.md", parseMarkdown("# Dirty\n"));
		useSessionStore.getState().setDirty("/docs/dirty.md", true);
	});

	it("closes a clean document without asking", async () => {
		const confirm = vi.fn(async () => true);

		expect(await closeTab("/docs/clean.md", confirm)).toBe(true);

		expect(confirm).not.toHaveBeenCalled();
		expect(paths()).toEqual(["/docs/dirty.md"]);
	});

	it("asks before closing a document with unsaved changes", async () => {
		const confirm = vi.fn(async () => true);

		expect(await closeTab("/docs/dirty.md", confirm)).toBe(true);

		expect(confirm).toHaveBeenCalledWith("dirty.md");
		expect(paths()).toEqual(["/docs/clean.md"]);
	});

	it("keeps the document open, still dirty, when the user declines", async () => {
		const confirm = vi.fn(async () => false);

		expect(await closeTab("/docs/dirty.md", confirm)).toBe(false);

		expect(paths()).toEqual(["/docs/clean.md", "/docs/dirty.md"]);
		expect(useSessionStore.getState().documents[1].dirty).toBe(true);
	});
});

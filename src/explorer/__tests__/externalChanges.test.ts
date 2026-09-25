import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerEditor } from "../../editor/editorRegistry";
import { installEditorFsHatch, readEditorFsHatch, remove, writeTextFile } from "../../editor/fs";
import { shouldWrite } from "../../editor/savePolicy";
import { openFileAtPath } from "../../store/openFile";
import { selectDocument, useSessionStore } from "../../store/session";
import { applyExternalChanges, resolveConflict } from "../externalChanges";
import { fileEntry } from "../memoryBackend";
import type { WatchChange } from "../types";

const ROOT = "/w";
const DOC = "/w/notes/doc.md";
const ORIGINAL = "# Doc\n\nOriginal.\n";
const EXTERNAL = "# Doc\n\nChanged elsewhere.\n";

const modified: WatchChange = { kind: "modified", entry: fileEntry("notes/doc.md") };
const removed: WatchChange = { kind: "removed", path: "notes/doc.md" };

function document() {
	return selectDocument(useSessionStore.getState(), DOC)!;
}

function paragraphText(): string {
	const paragraph = document().tree.children[1];
	return paragraph.type === "paragraph" && paragraph.children[0].type === "text" ? paragraph.children[0].value : "";
}

describe("external changes to an open document", () => {
	beforeEach(async () => {
		installEditorFsHatch({ [DOC]: ORIGINAL });
		useSessionStore.setState({ documents: [], activePath: null, error: null });
		await openFileAtPath(DOC);
	});

	describe("when the document is clean", () => {
		it("reloads it from disk with no prompt", async () => {
			await writeTextFile(DOC, EXTERNAL);

			const external = await applyExternalChanges(ROOT, [modified]);

			expect(external).toEqual([{ path: DOC, outcome: "reloaded" }]);
			expect(document().conflict).toBeNull();
			expect(document().revision).toBe(1);
			expect(paragraphText()).toBe("Changed elsewhere.");
		});

		it("ignores an event that left the bytes unchanged", async () => {
			const external = await applyExternalChanges(ROOT, [modified]);

			expect(external).toEqual([]);
			expect(document().revision).toBe(0);
		});
	});

	describe("when the document is dirty", () => {
		beforeEach(() => {
			useSessionStore.getState().setDirty(DOC, true);
		});

		it("puts it in conflict instead of reloading", async () => {
			await writeTextFile(DOC, EXTERNAL);

			const external = await applyExternalChanges(ROOT, [modified]);

			expect(external).toEqual([{ path: DOC, outcome: "conflict" }]);
			expect(document().conflict).toEqual({ kind: "modified" });
			expect(document().dirty).toBe(true);
			expect(document().revision).toBe(0);
			expect(paragraphText()).toBe("Original.");
		});

		it("modifies neither the in-memory document nor the file while the conflict is unanswered", async () => {
			await writeTextFile(DOC, EXTERNAL);
			await applyExternalChanges(ROOT, [modified]);
			const before = document();

			// A second external event, and any save attempt, while pending.
			await applyExternalChanges(ROOT, [modified]);

			expect(document().tree).toBe(before.tree);
			expect(document().revision).toBe(0);
			expect(readEditorFsHatch(DOC)).toBe(EXTERNAL);
			expect(shouldWrite({ conflict: document().conflict, currentText: "local edit", baselineText: ORIGINAL })).toBe(false);
			expect(
				shouldWrite({ conflict: document().conflict, currentText: "local edit", baselineText: ORIGINAL, force: true }),
			).toBe(false);
		});

		it("reloads from disk when the user chooses to", async () => {
			await writeTextFile(DOC, EXTERNAL);
			await applyExternalChanges(ROOT, [modified]);

			await resolveConflict(DOC, "reload-from-disk");

			expect(document().conflict).toBeNull();
			expect(document().dirty).toBe(false);
			expect(document().revision).toBe(1);
			expect(paragraphText()).toBe("Changed elsewhere.");
		});

		it("keeps the local version and writes it when the user chooses to", async () => {
			const saveNow = vi.fn(async () => {});
			registerEditor(DOC, { saveNow });
			await writeTextFile(DOC, EXTERNAL);
			await applyExternalChanges(ROOT, [modified]);

			await resolveConflict(DOC, "keep-local");

			expect(document().conflict).toBeNull();
			expect(saveNow).toHaveBeenCalledWith({ force: true });
			expect(paragraphText()).toBe("Original.");
		});
	});

	describe("when the document is deleted on disk", () => {
		it("informs the user and keeps the in-memory content", async () => {
			await remove(DOC);

			const external = await applyExternalChanges(ROOT, [removed]);

			expect(external).toEqual([{ path: DOC, outcome: "deleted" }]);
			expect(document().conflict).toEqual({ kind: "deleted" });
			expect(paragraphText()).toBe("Original.");
			expect(useSessionStore.getState().documents).toHaveLength(1);
		});

		it("does the same for a document inside a deleted folder", async () => {
			await remove(DOC);

			const external = await applyExternalChanges(ROOT, [{ kind: "removed", path: "notes" }]);

			expect(external).toEqual([{ path: DOC, outcome: "deleted" }]);
		});

		it("treats a reported removal as a content change when the file is in fact still there", async () => {
			await writeTextFile(DOC, EXTERNAL);

			const external = await applyExternalChanges(ROOT, [removed]);

			expect(external).toEqual([{ path: DOC, outcome: "reloaded" }]);
		});

		it("writes it again when the user keeps it", async () => {
			const saveNow = vi.fn(async () => {});
			registerEditor(DOC, { saveNow });
			await remove(DOC);
			await applyExternalChanges(ROOT, [removed]);

			await resolveConflict(DOC, "keep-local");

			expect(saveNow).toHaveBeenCalledWith({ force: true });
			expect(document().conflict).toBeNull();
		});

		it("closes the tab when the user chooses to", async () => {
			await remove(DOC);
			await applyExternalChanges(ROOT, [removed]);

			await resolveConflict(DOC, "close");

			expect(useSessionStore.getState().documents).toEqual([]);
		});

		it("clears the notice if the same file comes back unchanged", async () => {
			await remove(DOC);
			await applyExternalChanges(ROOT, [removed]);
			await writeTextFile(DOC, ORIGINAL);

			const external = await applyExternalChanges(ROOT, [{ kind: "created", entry: fileEntry("notes/doc.md") }]);

			expect(external).toEqual([]);
			expect(document().conflict).toBeNull();
		});
	});

	it("ignores changes to files that are not open", async () => {
		const external = await applyExternalChanges(ROOT, [
			{ kind: "modified", entry: fileEntry("elsewhere.md") },
			{ kind: "removed", path: "gone.md" },
		]);

		expect(external).toEqual([]);
	});

	it("ignores documents opened from outside the workspace", async () => {
		installEditorFsHatch({ "/elsewhere/doc.md": ORIGINAL });
		await openFileAtPath("/elsewhere/doc.md");

		const external = await applyExternalChanges(ROOT, [{ kind: "removed", path: "doc.md" }]);

		expect(external).toEqual([]);
	});
});

describe("shouldWrite", () => {
	it("writes a changed document and skips an unchanged one", () => {
		expect(shouldWrite({ conflict: null, currentText: "b", baselineText: "a" })).toBe(true);
		expect(shouldWrite({ conflict: null, currentText: "a", baselineText: "a" })).toBe(false);
	});

	it("writes an unchanged document only when forced", () => {
		expect(shouldWrite({ conflict: null, currentText: "a", baselineText: "a", force: true })).toBe(true);
	});

	it("never writes while a conflict is unanswered", () => {
		expect(shouldWrite({ conflict: { kind: "modified" }, currentText: "b", baselineText: "a" })).toBe(false);
		expect(shouldWrite({ conflict: { kind: "deleted" }, currentText: "b", baselineText: "a", force: true })).toBe(false);
	});
});

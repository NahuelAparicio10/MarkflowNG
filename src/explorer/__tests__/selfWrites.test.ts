import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedAutosave } from "../../editor/autosave";
import { installEditorFsHatch, readEditorFsHatch, writeTextFile } from "../../editor/fs";
import { saveDocument } from "../../editor/saveDocument";
import { docFrom } from "../../editor/__tests__/harness";
import { openFileAtPath } from "../../store/openFile";
import { selectDocument, useSessionStore } from "../../store/session";
import { setWorkspaceBackend } from "../backend";
import { createMemoryWorkspaceBackend, fileEntry } from "../memoryBackend";
import { handleWatchBatch, openWorkspace } from "../openWorkspace";
import { applyExternalChanges } from "../externalChanges";
import { hashText, isKnownContent, recordSelfWrite } from "../selfWrites";

const ROOT = "/w";
const DOC = "/w/doc.md";
const OTHER = "/w/other.md";

async function setUp(): Promise<void> {
	installEditorFsHatch({ [DOC]: "# Doc\n", [OTHER]: "# Other\n" });
	useSessionStore.setState({ documents: [], activePath: null, error: null });
	setWorkspaceBackend(createMemoryWorkspaceBackend(["doc.md", "other.md"]));
	await openWorkspace(ROOT);
	await openFileAtPath(DOC);
	await openFileAtPath(OTHER);
}

function document(path: string) {
	return selectDocument(useSessionStore.getState(), path)!;
}

describe("self-write tagging", () => {
	beforeEach(setUp);

	it("recognises content by hash, not by timing or path alone", () => {
		recordSelfWrite(DOC, "# Mine\n");

		expect(isKnownContent(DOC, "# Mine\n")).toBe(true);
		expect(isKnownContent(DOC, "# Theirs\n")).toBe(false);
		expect(isKnownContent(OTHER, "# Mine\n")).toBe(false);
		expect(hashText("a")).not.toBe(hashText("b"));
	});

	it("treats Windows and forward-slash spellings of a path as the same file", () => {
		recordSelfWrite("C:\\w\\doc.md", "text");

		expect(isKnownContent("C:/w/doc.md", "text")).toBe(true);
	});

	describe("an autosave", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("produces no external-change notification for the document it wrote", async () => {
			useSessionStore.getState().setDirty(DOC, true);
			let saved: Promise<string> | null = null;
			const autosave = createDebouncedAutosave(() => {
				saved = saveDocument(DOC, docFrom("# Doc\n\nEdited by the user.\n"));
			}, 2000);

			autosave.schedule();
			await vi.advanceTimersByTimeAsync(2000);
			expect(saved).not.toBeNull();
			await saved;
			useSessionStore.getState().setDirty(DOC, false);
			expect(readEditorFsHatch(DOC)).toContain("Edited by the user.");

			// What the Rust watcher reports for that write.
			const external = await applyExternalChanges(ROOT, [{ kind: "modified", entry: fileEntry("doc.md") }]);

			expect(external).toEqual([]);
			expect(document(DOC).conflict).toBeNull();
			expect(document(DOC).revision).toBe(0);
		});

		it("is still recognised if the document was edited again before the event arrived", async () => {
			await saveDocument(DOC, docFrom("# Doc\n\nFirst save.\n"));
			useSessionStore.getState().setDirty(DOC, true);

			const external = await applyExternalChanges(ROOT, [{ kind: "modified", entry: fileEntry("doc.md") }]);

			expect(external).toEqual([]);
			expect(document(DOC).conflict).toBeNull();
		});
	});

	it("still reports a different file modified by another program while a save is in progress", async () => {
		const save = saveDocument(DOC, docFrom("# Doc\n\nSaving.\n"));
		await writeTextFile(OTHER, "# Other\n\nChanged by another program.\n");
		await save;

		const external = await applyExternalChanges(ROOT, [
			{ kind: "modified", entry: fileEntry("doc.md") },
			{ kind: "modified", entry: fileEntry("other.md") },
		]);

		expect(external).toEqual([{ path: OTHER, outcome: "reloaded" }]);
		expect(document(OTHER).outline.entries.map((entry) => entry.text)).toEqual(["Other"]);
		expect(document(OTHER).revision).toBe(1);
		expect(document(DOC).revision).toBe(0);
	});

	it("still reports an external write to the same file that lands after the save", async () => {
		await saveDocument(DOC, docFrom("# Doc\n\nMine.\n"));
		await writeTextFile(DOC, "# Doc\n\nTheirs, written right after.\n");

		const external = await applyExternalChanges(ROOT, [{ kind: "modified", entry: fileEntry("doc.md") }]);

		expect(external).toEqual([{ path: DOC, outcome: "reloaded" }]);
	});

	it("reaches the frontend through the same batch handler the watcher uses", async () => {
		await saveDocument(DOC, docFrom("# Doc\n\nVia the handler.\n"));

		await handleWatchBatch(ROOT, { changes: [{ kind: "modified", entry: fileEntry("doc.md") }] });

		expect(document(DOC).revision).toBe(0);
		expect(document(DOC).conflict).toBeNull();
	});
});

describe("the watcher is never suspended around a write", () => {
	const source = (...segments: string[]) =>
		readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", ...segments), "utf8");

	const WATCHER_CONTROL = /unwatch|stop_watching|stopWatching|closeWorkspace|pauseWatch|suspend/i;

	it.each([
		["editor/saveDocument.ts"],
		["editor/EditorView.tsx"],
		["editor/fs.ts"],
		["editor/autosave.ts"],
	])("%s does not stop, pause or unsubscribe the watcher", (file) => {
		expect(source(...file.split("/"))).not.toMatch(WATCHER_CONTROL);
	});

	it("records the self-write before the first write call in saveDocument", () => {
		const text = source("editor", "saveDocument.ts");
		const body = text.slice(text.indexOf("export async function saveDocument"));

		expect(body.indexOf("recordSelfWrite(")).toBeGreaterThan(-1);
		expect(body.indexOf("recordSelfWrite(")).toBeLessThan(body.indexOf("await writeTextFile("));
	});

	it("offers no Rust command to pause or suspend watching", () => {
		const watcher = source("..", "src-tauri", "src", "watcher.rs");
		const commands = [...watcher.matchAll(/#\[tauri::command\]\s*pub fn (\w+)/g)].map((match) => match[1]);

		expect(commands.sort()).toEqual(["start_watching", "stop_watching"]);
	});
});

import { beforeEach, describe, expect, it } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { selectActiveDocument, selectDocument, useSessionStore, type OpenDocument, type ViewMode } from "../session";

const VALID_MODES: readonly ViewMode[] = ["reader", "raw", "editor"];

function resetStore(): void {
	useSessionStore.setState({ documents: [], activePath: null, error: null });
}

function open(path: string, source = "# Title\n"): void {
	useSessionStore.getState().openDocument(path, parseMarkdown(source));
}

function active(): OpenDocument {
	const document = selectActiveDocument(useSessionStore.getState());
	expect(document, "expected an active document").not.toBeNull();
	return document!;
}

function documentAt(path: string): OpenDocument {
	const document = selectDocument(useSessionStore.getState(), path);
	expect(document, `expected ${path} to be open`).not.toBeNull();
	return document!;
}

describe("session store", () => {
	beforeEach(resetStore);

	it("represents each document's view as exactly one mode value, never a combination of flags", () => {
		// The document shape has one `mode` field and no boolean flags at all,
		// so there is no way to construct a state where two modes are active.
		open("/docs/example.md");
		const keys = Object.keys(active());

		expect(keys).toContain("mode");
		expect(keys.filter((key) => key.toLowerCase().startsWith("is"))).toEqual([]);
		expect(VALID_MODES).toContain(active().mode);
	});

	it("setMode replaces the active document's mode rather than accumulating state", () => {
		open("/docs/example.md");

		useSessionStore.getState().setMode("raw");
		expect(active().mode).toBe("raw");

		useSessionStore.getState().setMode("reader");
		expect(active().mode).toBe("reader");
	});

	it("cycleMode visits reader, raw and editor in order, then wraps around", () => {
		open("/docs/example.md");
		expect(active().mode).toBe("reader");

		useSessionStore.getState().cycleMode();
		expect(active().mode).toBe("raw");

		useSessionStore.getState().cycleMode();
		expect(active().mode).toBe("editor");

		useSessionStore.getState().cycleMode();
		expect(active().mode).toBe("reader");
	});

	it("mode changes only affect the active document", () => {
		open("/docs/first.md");
		open("/docs/second.md");

		useSessionStore.getState().setMode("editor");

		expect(documentAt("/docs/second.md").mode).toBe("editor");
		expect(documentAt("/docs/first.md").mode).toBe("reader");
	});

	it("setDirty replaces the dirty flag of the named document only", () => {
		open("/docs/first.md");
		open("/docs/second.md");

		useSessionStore.getState().setDirty("/docs/first.md", true);
		expect(documentAt("/docs/first.md").dirty).toBe(true);
		expect(documentAt("/docs/second.md").dirty).toBe(false);

		useSessionStore.getState().setDirty("/docs/first.md", false);
		expect(documentAt("/docs/first.md").dirty).toBe(false);
	});

	it("opening a document starts it clean, in reader mode, with its outline derived", () => {
		open("/docs/example.md", "# Title\n\nBody.\n");

		const document = active();
		expect(document.mode).toBe("reader");
		expect(document.dirty).toBe(false);
		expect(document.path).toBe("/docs/example.md");
		expect(document.name).toBe("example.md");
		expect(document.outline.entries).toEqual([{ id: "title", text: "Title", depth: 1 }]);
	});

	it("opening a second document adds a tab and activates it, keeping the first", () => {
		open("/docs/first.md", "# First\n");
		open("/docs/second.md", "# Second\n");

		const state = useSessionStore.getState();
		expect(state.documents.map((document) => document.path)).toEqual(["/docs/first.md", "/docs/second.md"]);
		expect(state.activePath).toBe("/docs/second.md");
		expect(active().outline.entries).toEqual([{ id: "second", text: "Second", depth: 1 }]);
	});

	it("reopening an already open document activates it without replacing its state", () => {
		open("/docs/first.md", "# First\n");
		useSessionStore.getState().setDirty("/docs/first.md", true);
		open("/docs/second.md");

		open("/docs/first.md", "# Something else\n");

		const state = useSessionStore.getState();
		expect(state.documents).toHaveLength(2);
		expect(state.activePath).toBe("/docs/first.md");
		expect(active().dirty).toBe(true);
		expect(active().outline.entries[0].text).toBe("First");
	});

	it("closing the active document activates its neighbour", () => {
		open("/docs/a.md");
		open("/docs/b.md");
		open("/docs/c.md");
		useSessionStore.getState().activateDocument("/docs/b.md");

		useSessionStore.getState().closeDocument("/docs/b.md");
		expect(useSessionStore.getState().activePath).toBe("/docs/c.md");

		useSessionStore.getState().closeDocument("/docs/c.md");
		expect(useSessionStore.getState().activePath).toBe("/docs/a.md");

		useSessionStore.getState().closeDocument("/docs/a.md");
		expect(useSessionStore.getState().activePath).toBeNull();
		expect(selectActiveDocument(useSessionStore.getState())).toBeNull();
	});

	it("closing an inactive document keeps the active one", () => {
		open("/docs/a.md");
		open("/docs/b.md");

		useSessionStore.getState().closeDocument("/docs/a.md");

		expect(useSessionStore.getState().activePath).toBe("/docs/b.md");
		expect(useSessionStore.getState().documents).toHaveLength(1);
	});

	it("reloadDocument replaces the snapshot, clears dirty and conflict, and bumps the revision", () => {
		open("/docs/example.md", "# Old\n");
		useSessionStore.getState().setDirty("/docs/example.md", true);
		useSessionStore.getState().setConflict("/docs/example.md", { kind: "modified" });

		useSessionStore.getState().reloadDocument("/docs/example.md", parseMarkdown("# New\n"));

		const document = active();
		expect(document.outline.entries[0].text).toBe("New");
		expect(document.dirty).toBe(false);
		expect(document.conflict).toBeNull();
		expect(document.revision).toBe(1);
	});

	it("exposes the active document's path, tree, mode and outline from a single store", () => {
		open("/docs/example.md");

		const document = active();
		expect(document.path).not.toBeNull();
		expect(document.tree).not.toBeNull();
		expect(document.mode).toBe("reader");
		expect(document.outline).not.toBeNull();
	});
});

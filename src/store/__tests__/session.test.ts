import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../core/markdown";
import { useSessionStore, type SessionState, type ViewMode } from "../session";

const VALID_MODES: readonly ViewMode[] = ["reader", "raw", "editor"];

function resetStore(): void {
	useSessionStore.setState({
		filePath: null,
		fileName: null,
		tree: null,
		mode: "reader",
		outline: { entries: [], idsByHeading: new Map() },
		error: null,
		dirty: false,
	});
}

describe("session store", () => {
	it("represents the active view as exactly one mode value, never a combination of flags", () => {
		// The state shape has one `mode` field and no boolean flags at all, so
		// there is no way to construct a state where two modes are active.
		const state: SessionState = useSessionStore.getState();
		const keys = Object.keys(state);

		expect(keys).toContain("mode");
		expect(keys.filter((key) => key.toLowerCase().startsWith("is"))).toEqual([]);
		expect(VALID_MODES).toContain(state.mode);
	});

	it("setMode replaces the mode rather than accumulating state", () => {
		resetStore();

		useSessionStore.getState().setMode("raw");
		expect(useSessionStore.getState().mode).toBe("raw");

		useSessionStore.getState().setMode("reader");
		expect(useSessionStore.getState().mode).toBe("reader");
	});

	it("cycleMode visits reader, raw and editor in order, then wraps around", () => {
		resetStore();

		expect(useSessionStore.getState().mode).toBe("reader");

		useSessionStore.getState().cycleMode();
		expect(useSessionStore.getState().mode).toBe("raw");

		useSessionStore.getState().cycleMode();
		expect(useSessionStore.getState().mode).toBe("editor");

		useSessionStore.getState().cycleMode();
		expect(useSessionStore.getState().mode).toBe("reader");
	});

	it("setDirty replaces the dirty flag", () => {
		resetStore();
		expect(useSessionStore.getState().dirty).toBe(false);

		useSessionStore.getState().setDirty(true);
		expect(useSessionStore.getState().dirty).toBe(true);

		useSessionStore.getState().setDirty(false);
		expect(useSessionStore.getState().dirty).toBe(false);
	});

	it("opening a document clears the dirty flag", () => {
		resetStore();
		useSessionStore.getState().setDirty(true);

		useSessionStore.getState().openDocument("/docs/example.md", parseMarkdown("# Title\n"));
		expect(useSessionStore.getState().dirty).toBe(false);
	});

	it("opening a document resets the mode to reader and derives the outline", () => {
		resetStore();
		useSessionStore.getState().setMode("raw");

		useSessionStore.getState().openDocument("/docs/example.md", parseMarkdown("# Title\n\nBody.\n"));

		const state = useSessionStore.getState();
		expect(state.mode).toBe("reader");
		expect(state.filePath).toBe("/docs/example.md");
		expect(state.fileName).toBe("example.md");
		expect(state.outline.entries).toEqual([{ id: "title", text: "Title", depth: 1 }]);
	});

	it("opening a second document replaces the first entirely", () => {
		resetStore();
		useSessionStore.getState().openDocument("/docs/first.md", parseMarkdown("# First\n"));
		useSessionStore.getState().openDocument("/docs/second.md", parseMarkdown("# Second\n"));

		const state = useSessionStore.getState();
		expect(state.filePath).toBe("/docs/second.md");
		expect(state.outline.entries).toEqual([{ id: "second", text: "Second", depth: 1 }]);
	});

	it("exposes the file path, tree, mode and outline from a single store", () => {
		resetStore();
		useSessionStore.getState().openDocument("/docs/example.md", parseMarkdown("# Title\n"));

		const state = useSessionStore.getState();
		expect(state.filePath).not.toBeNull();
		expect(state.tree).not.toBeNull();
		expect(state.mode).toBe("reader");
		expect(state.outline).not.toBeNull();
	});
});

import { describe, expect, it, vi } from "vitest";
import { citationAnchor, openCitation } from "./citations";
import { openFileAtPath } from "../store/openFile";
import { useSessionStore } from "../store/session";
import { useWorkspaceStore } from "../store/workspace";

vi.mock("../store/openFile", () => ({ openFileAtPath: vi.fn(async (path: string) => {
	useSessionStore.setState({ activePath: path, documents: [{
		path, name: "doc.md", tree: { type: "root", children: [] }, mode: "reader", outline: { entries: [
			{ id: "parent", text: "Parent", depth: 1 }, { id: "child", text: "Child", depth: 2 },
			{ id: "other", text: "Other", depth: 1 },
		], idsByHeading: new Map() }, dirty: false, revision: 0, conflict: null,
	}], notice: null });
}) }));

describe("workspace citations", () => {
	it("resolves duplicate heading text by full heading path", () => {
		const entries = [
			{ id: "first-parent", text: "Parent", depth: 1 as const },
			{ id: "first", text: "Setup", depth: 2 as const },
			{ id: "second-parent", text: "Other", depth: 1 as const },
			{ id: "second", text: "Setup", depth: 2 as const },
		];
		expect(citationAnchor(entries, ["Other", "Setup"])).toBe("second");
		expect(citationAnchor(entries, ["Gone"])).toBeNull();
	});

	it("opens a valid file citation and reports a stale section", async () => {
		vi.mocked(openFileAtPath).mockClear();
		const root = "C:/workspace";
		await openCitation(root, { file: "docs/a.md", headings: ["Gone"], line: 14 });
		expect(openFileAtPath).toHaveBeenCalledWith("C:/workspace/docs/a.md");
		expect(useSessionStore.getState().notice).toContain("section was not found");
		expect(useSessionStore.getState().documents[0].mode).toBe("reader");
		expect(useWorkspaceStore.getState().previewPath).toBeNull();
	});

	it("refuses traversal and absolute paths from malformed citations", async () => {
		vi.mocked(openFileAtPath).mockClear();
		await openCitation("C:/workspace", { file: "../secret.md", headings: [], line: 1 });
		await openCitation("C:/workspace", { file: "D:/secret.md", headings: [], line: 1 });
		expect(openFileAtPath).not.toHaveBeenCalled();
	});
});

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "../../store/workspace";
import { FileTreeView, TREE_ROW_HEIGHT } from "../FileTree";
import { fileEntry } from "../memoryBackend";
import { buildChildIndex, flattenVisibleRows } from "../treeModel";
import type { WorkspaceEntry } from "../types";

function directory(path: string): WorkspaceEntry {
	return { path, kind: "directory", markdown: false };
}

function entriesOf(...entries: WorkspaceEntry[]): Map<string, WorkspaceEntry> {
	return new Map(entries.map((entry) => [entry.path, entry]));
}

function rowPaths(entries: Map<string, WorkspaceEntry>, expanded: string[] = []): string[] {
	return flattenVisibleRows(buildChildIndex(entries), new Set(expanded)).map((row) => row.path);
}

describe("tree model", () => {
	const entries = entriesOf(
		fileEntry("readme.md"),
		directory("design"),
		fileEntry("design/combat.md"),
		directory("design/enemies"),
		fileEntry("design/enemies/boss.md"),
		fileEntry("design/balance.csv"),
		fileEntry("art.png"),
	);

	it("shows only top-level entries while every folder is collapsed", () => {
		expect(rowPaths(entries)).toEqual(["design", "art.png", "readme.md"]);
	});

	it("lists folders first, then files, each by name", () => {
		expect(rowPaths(entries, ["design"])).toEqual([
			"design",
			"design/enemies",
			"design/balance.csv",
			"design/combat.md",
			"art.png",
			"readme.md",
		]);
	});

	it("does not show the children of an expanded folder whose parent is collapsed", () => {
		expect(rowPaths(entries, ["design/enemies"])).toEqual(["design", "art.png", "readme.md"]);
	});

	it("sorts numbered names naturally", () => {
		const numbered = entriesOf(fileEntry("chapter-10.md"), fileEntry("chapter-2.md"), fileEntry("chapter-1.md"));

		expect(rowPaths(numbered)).toEqual(["chapter-1.md", "chapter-2.md", "chapter-10.md"]);
	});

	it("records depth and expansion on each row", () => {
		const rows = flattenVisibleRows(buildChildIndex(entries), new Set(["design", "design/enemies"]));
		const boss = rows.find((row) => row.path === "design/enemies/boss.md")!;

		expect(boss.depth).toBe(2);
		expect(boss.name).toBe("boss.md");
		expect(rows.find((row) => row.path === "design")!.expanded).toBe(true);
	});
});

describe("workspace listing updates from watcher events", () => {
	beforeEach(() => {
		useWorkspaceStore.getState().beginWorkspace("/w");
		useWorkspaceStore
			.getState()
			.addEntries([directory("docs"), fileEntry("docs/a.md"), fileEntry("docs/b.md"), fileEntry("top.md")]);
		useWorkspaceStore.getState().setExpanded("docs", true);
	});

	const paths = () => [...useWorkspaceStore.getState().entries.keys()].sort();

	it("adds a created file, and the folders above it", () => {
		useWorkspaceStore.getState().applyChanges([{ kind: "created", entry: fileEntry("new/deep/c.md") }]);

		expect(paths()).toContain("new/deep/c.md");
		expect(paths()).toContain("new/deep");
		expect(useWorkspaceStore.getState().entries.get("new")?.kind).toBe("directory");
	});

	it("removes a deleted file", () => {
		useWorkspaceStore.getState().applyChanges([{ kind: "removed", path: "docs/a.md" }]);

		expect(paths()).toEqual(["docs", "docs/b.md", "top.md"]);
	});

	it("removes a deleted folder with everything in it and forgets it was expanded", () => {
		useWorkspaceStore.getState().select("docs/a.md");
		useWorkspaceStore.getState().applyChanges([{ kind: "removed", path: "docs" }]);

		expect(paths()).toEqual(["top.md"]);
		expect(useWorkspaceStore.getState().expanded.has("docs")).toBe(false);
		expect(useWorkspaceStore.getState().selectedPath).toBeNull();
	});

	it("shows a renamed file under its new name only", () => {
		useWorkspaceStore.getState().applyChanges([{ kind: "renamed", from: "docs/a.md", entry: fileEntry("docs/z.md") }]);

		expect(paths()).toEqual(["docs", "docs/b.md", "docs/z.md", "top.md"]);
	});

	it("does not touch a sibling whose name merely starts with a removed folder's name", () => {
		useWorkspaceStore.getState().addEntries([directory("docs-old"), fileEntry("docs-old/x.md")]);

		useWorkspaceStore.getState().applyChanges([{ kind: "removed", path: "docs" }]);

		expect(paths()).toEqual(["docs-old", "docs-old/x.md", "top.md"]);
	});
});

describe("FileTree rendering", () => {
	it("mounts only the rows inside the viewport, however large the workspace", () => {
		const entries: WorkspaceEntry[] = [];
		for (let index = 0; index < 5000; index++) {
			entries.push(fileEntry(`doc-${String(index).padStart(4, "0")}.md`));
		}

		const viewportRows = 20;
		const html = renderToStaticMarkup(
			<FileTreeView
				entries={entriesOf(...entries)}
				expanded={new Set()}
				selectedPath={null}
				onOpen={() => {}}
				initialRect={{ width: 300, height: viewportRows * TREE_ROW_HEIGHT }}
			/>,
		);
		const mounted = html.match(/role="treeitem"/g)?.length ?? 0;

		expect(mounted).toBeGreaterThanOrEqual(viewportRows);
		// The viewport plus the virtualizer's overscan of 10 — nowhere near 5000.
		expect(mounted).toBeLessThanOrEqual(viewportRows + 10);
		expect(html).toContain("doc-0000.md");
		expect(html).not.toContain("doc-4999.md");
		// The scroll height still accounts for every row.
		expect(html).toContain(`height:${5000 * TREE_ROW_HEIGHT}px`);
	});

	it("greys out non-Markdown files", () => {
		const html = renderToStaticMarkup(
			<FileTreeView
				entries={entriesOf(fileEntry("notes.md"), fileEntry("image.png"))}
				expanded={new Set()}
				selectedPath={null}
				onOpen={() => {}}
				initialRect={{ width: 300, height: 240 }}
			/>,
		);

		expect(html).toMatch(/aria-disabled="true"[^>]*data-path="image\.png"/);
		expect(html).not.toMatch(/aria-disabled="true"[^>]*data-path="notes\.md"/);
	});
});

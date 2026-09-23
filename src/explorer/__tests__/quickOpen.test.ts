import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { selectMarkdownFiles, useWorkspaceStore } from "../../store/workspace";
import { fuzzyMatch, rankFuzzy } from "../fuzzy";
import { fileEntry } from "../memoryBackend";

const PATHS = [
	"README.md",
	"design/combat/combat-system.md",
	"design/combat/parry-windows.md",
	"design/enemies/boss-patterns.md",
	"design/enemies/enemy-ai.md",
	"docs/architecture.md",
	"docs/coding-standards.md",
	"specs/combat-timeline-editor.md",
];

const rankedPaths = (query: string) => rankFuzzy(query, PATHS, 10).map((result) => result.path);

describe("fuzzy matching", () => {
	it("matches a partial, non-contiguous fragment of a path", () => {
		expect(fuzzyMatch("cmbtsys", "design/combat/combat-system.md")).not.toBeNull();
		expect(fuzzyMatch("dsgnbss", "design/enemies/boss-patterns.md")).not.toBeNull();
	});

	it("ignores case and whitespace in the query", () => {
		expect(fuzzyMatch("Boss Pat", "design/enemies/boss-patterns.md")).not.toBeNull();
	});

	it("rejects a path that does not contain the query in order", () => {
		expect(fuzzyMatch("xyz", "design/combat/combat-system.md")).toBeNull();
		expect(fuzzyMatch("mdcombat", "design/combat/combat-system.md")).toBeNull();
	});

	it("reports the matched positions for highlighting", () => {
		const match = fuzzyMatch("arch", "docs/architecture.md")!;

		expect(match.positions).toEqual([5, 6, 7, 8]);
	});

	it("prefers the tightest window over the first scattered one", () => {
		const match = fuzzyMatch("ai", "design/enemies/enemy-ai.md")!;

		expect(match.positions).toEqual([21, 22]);
	});
});

describe("ranking", () => {
	it("ranks a match at word boundaries in the file name above a scattered one", () => {
		expect(rankedPaths("bp")[0]).toBe("design/enemies/boss-patterns.md");
		expect(rankedPaths("parry")[0]).toBe("design/combat/parry-windows.md");
	});

	it("ranks a contiguous match above a spread-out one", () => {
		const spread = "docs/common-battle.md";
		const contiguous = "specs/combat-timeline.md";

		expect(fuzzyMatch("combat", spread)).not.toBeNull();
		expect(rankFuzzy("combat", [spread, contiguous], 10).map((result) => result.path)).toEqual([contiguous, spread]);
	});

	it("ranks a file-name match above a folder-name match", () => {
		expect(rankedPaths("enemy")[0]).toBe("design/enemies/enemy-ai.md");
	});

	it("lists only matching paths, and at most the limit", () => {
		expect(rankedPaths("zzz")).toEqual([]);
		expect(rankFuzzy("", PATHS, 3)).toHaveLength(3);
		expect(rankFuzzy("d", PATHS, 2)).toHaveLength(2);
	});

	it("stays fast enough to run on every keystroke over a large workspace", () => {
		const large: string[] = [];
		for (let index = 0; index < 20000; index++) {
			large.push(`design/section-${index % 40}/sub-${index % 7}/document-number-${index}.md`);
		}

		rankFuzzy("warmup", large, 50);
		const started = performance.now();
		const results = rankFuzzy("sec3dn42", large, 50);
		const elapsed = performance.now() - started;

		expect(results.length).toBeGreaterThan(0);
		// Generous so it does not flake on a slow CI box; locally it is a
		// few tens of milliseconds for 20,000 paths.
		expect(elapsed).toBeLessThan(250);
	});
});

describe("quick open listing cache", () => {
	beforeEach(() => {
		useWorkspaceStore.getState().beginWorkspace("/w");
		useWorkspaceStore.getState().addEntries([fileEntry("a.md"), fileEntry("b.md"), fileEntry("image.png")]);
	});

	it("lists only Markdown files", () => {
		expect(selectMarkdownFiles(useWorkspaceStore.getState())).toEqual(["a.md", "b.md"]);
	});

	it("is derived once per listing, not per read", () => {
		const state = useWorkspaceStore.getState();

		expect(selectMarkdownFiles(state)).toBe(selectMarkdownFiles(state));
	});

	it("reflects files created and deleted externally on the next invocation", () => {
		useWorkspaceStore.getState().applyChanges([
			{ kind: "created", entry: fileEntry("notes/new.md") },
			{ kind: "removed", path: "a.md" },
		]);

		const files = selectMarkdownFiles(useWorkspaceStore.getState());

		expect(files).toEqual(["b.md", "notes/new.md"]);
		expect(rankFuzzy("new", files, 10).map((result) => result.path)).toEqual(["notes/new.md"]);
	});
});

describe("quick open issues no backend call per keystroke", () => {
	const source = (file: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", file), "utf8");

	it.each([["QuickOpen.tsx"], ["fuzzy.ts"]])("%s imports nothing that reaches the backend", (file) => {
		const text = source(file);

		expect(text).not.toMatch(/@tauri-apps|from "\.\/backend"|invoke\(|readTextFile|readDir/);
	});
});

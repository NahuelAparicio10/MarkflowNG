import { parseMarkdown } from "../core/markdown";
import { installEditorFsHatch, readEditorFsHatch, remove, writeTextFile } from "../editor/fs";
import { setWorkspaceBackend } from "../explorer/backend";
import { createMemoryWorkspaceBackend, fileEntry, type MemoryWorkspaceBackend } from "../explorer/memoryBackend";
import { openWorkspace } from "../explorer/openWorkspace";
import { joinWorkspacePath } from "../explorer/paths";
import { useSessionStore } from "./session";

/** The path fixtures loaded through this hatch are known by. */
const FIXTURE_PATH = "fixture.md";

/** The root workspaces loaded through this hatch are opened at. */
const WORKSPACE_ROOT = "/workspace";

declare global {
	interface Window {
		/** Dev/e2e only. See `installDevFixtureHatch` for why this exists. */
		__markflowLoadFixture?: (source: string) => void;
		/** Dev/e2e only. Reads back what the editor last wrote for the open fixture. */
		__markflowReadFixtureFile?: () => string | undefined;
		/** Dev/e2e only. Opens an in-memory workspace of root-relative paths to content. */
		__markflowLoadWorkspace?: (files: Record<string, string>) => Promise<void>;
		/** Dev/e2e only. Reads back a workspace file by root-relative path. */
		__markflowReadWorkspaceFile?: (relativePath: string) => string | undefined;
		/**
		 * Dev/e2e only. Changes a workspace file as another program would —
		 * `null` deletes it — and reports it through the watcher.
		 */
		__markflowChangeExternally?: (relativePath: string, content: string | null) => Promise<void>;
	}
}

/**
 * Exposes a way to load a document without the Tauri file dialog, which does
 * not exist when the app runs as a plain page — as it does under
 * `npm run dev` for Playwright, since `tests/e2e` drives the Vite dev server
 * directly rather than a built Tauri binary. Dev/test builds only.
 *
 * Also installs the editor's in-memory filesystem hatch (`src/editor/fs.ts`)
 * with the same source under the same path, so switching to editor mode and
 * saving works end to end in the same e2e run, without OS file access.
 *
 * Workspaces get the same treatment: files go into the in-memory filesystem,
 * and the Rust scan and watcher are replaced by an in-memory backend, so the
 * tree, quick open, preview and tabs run their real code paths.
 */
export function installDevFixtureHatch(): void {
	if (!import.meta.env.DEV) {
		return;
	}

	window.__markflowLoadFixture = (source: string) => {
		installEditorFsHatch({ [FIXTURE_PATH]: source });
		useSessionStore.getState().openDocument(FIXTURE_PATH, parseMarkdown(source));
	};

	window.__markflowReadFixtureFile = () => readEditorFsHatch(FIXTURE_PATH);

	let backend: MemoryWorkspaceBackend | null = null;

	window.__markflowLoadWorkspace = async (files) => {
		const absolute: Record<string, string> = {};
		for (const [relativePath, content] of Object.entries(files)) {
			absolute[joinWorkspacePath(WORKSPACE_ROOT, relativePath)] = content;
		}

		installEditorFsHatch(absolute);
		backend = createMemoryWorkspaceBackend(Object.keys(files));
		setWorkspaceBackend(backend);
		await openWorkspace(WORKSPACE_ROOT);
	};

	window.__markflowReadWorkspaceFile = (relativePath) =>
		readEditorFsHatch(joinWorkspacePath(WORKSPACE_ROOT, relativePath));

	window.__markflowChangeExternally = async (relativePath, content) => {
		const path = joinWorkspacePath(WORKSPACE_ROOT, relativePath);
		if (content === null) {
			await remove(path);
			backend?.emit({ changes: [{ kind: "removed", path: relativePath }] });
		} else {
			await writeTextFile(path, content);
			backend?.emit({ changes: [{ kind: "modified", entry: fileEntry(relativePath) }] });
		}
	};
}

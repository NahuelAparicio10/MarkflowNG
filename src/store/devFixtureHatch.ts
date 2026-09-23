import { parseMarkdown } from "../core/markdown";
import { installEditorFsHatch, readEditorFsHatch } from "../editor/fs";
import { useSessionStore } from "./session";

/** The path fixtures loaded through this hatch are known by. */
const FIXTURE_PATH = "fixture.md";

declare global {
	interface Window {
		/** Dev/e2e only. See `installDevFixtureHatch` for why this exists. */
		__markflowLoadFixture?: (source: string) => void;
		/** Dev/e2e only. Reads back what the editor last wrote for the open fixture. */
		__markflowReadFixtureFile?: () => string | undefined;
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
}

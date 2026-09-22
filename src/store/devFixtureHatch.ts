import { parseMarkdown } from "../core/markdown";
import { useSessionStore } from "./session";

declare global {
	interface Window {
		/** Dev/e2e only. See `installDevFixtureHatch` for why this exists. */
		__markflowLoadFixture?: (source: string) => void;
	}
}

/**
 * Exposes a way to load a document without the Tauri file dialog, which does
 * not exist when the app runs as a plain page — as it does under
 * `npm run dev` for Playwright, since `tests/e2e` drives the Vite dev server
 * directly rather than a built Tauri binary. Dev/test builds only.
 */
export function installDevFixtureHatch(): void {
	if (!import.meta.env.DEV) {
		return;
	}

	window.__markflowLoadFixture = (source: string) => {
		useSessionStore.getState().openDocument("fixture.md", parseMarkdown(source));
	};
}

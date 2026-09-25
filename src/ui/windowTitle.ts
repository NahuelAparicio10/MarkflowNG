import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Reflects the open file's name and dirty state in the window title. A
 * no-op failure outside Tauri (plain browser dev server, e2e tests) is
 * expected and ignored.
 *
 * `getCurrentWindow()` itself throws synchronously outside a real Tauri
 * webview — it is not only `setTitle()` that can fail — so the whole call is
 * wrapped rather than just chaining `.catch()` on the promise.
 */
export function syncWindowTitle(fileName: string | null, dirty = false): void {
	const marker = fileName && dirty ? "● " : "";
	const title = fileName ? `${marker}${fileName} — Markflow` : "Markflow";

	try {
		void getCurrentWindow().setTitle(title).catch(() => {});
	} catch {
		// Not running inside Tauri.
	}
}

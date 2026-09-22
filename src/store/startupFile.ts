import { listen } from "@tauri-apps/api/event";
import { openFileAtPath } from "./openFile";
import { useSessionStore } from "./session";

interface StartupFilePayload {
	path: string | null;
	error: string | null;
}

/**
 * Subscribes to the `startup-file` event emitted once by the Rust side in
 * `src-tauri/src/lib.rs`, which reads the OS-provided file argument — not
 * reachable from the webview — and reports what it found.
 *
 * Called from `main.tsx` before React renders, so the listener is registered
 * as early as the frontend can manage, minimising the window between Rust
 * emitting the event during `setup()` and the frontend being ready for it.
 */
export function listenForStartupFile(): void {
	listen<StartupFilePayload>("startup-file", (event) => {
		const { path, error } = event.payload;

		if (path) {
			void openFileAtPath(path);
			return;
		}

		if (error) {
			useSessionStore.getState().setError(error);
		}
	}).catch(() => {
		// Not running inside Tauri (e.g. `npm run dev` in a plain browser for
		// e2e tests): there is no startup event to listen for.
	});
}

import { invoke } from "@tauri-apps/api/core";
import { openFileAtPath } from "./openFile";
import { useSessionStore } from "./session";

interface StartupFilePayload {
	path: string | null;
	error: string | null;
}

/** Query OS launch arguments after the webview is initialized. */
export async function openStartupFile(): Promise<void> {
	try {
		const { path, error } = await invoke<StartupFilePayload>("startup_file");
		if (path) await openFileAtPath(path);
		else if (error) useSessionStore.getState().setError(error);
	} catch {
		// Plain-browser development has no Tauri command bridge.
	}
}

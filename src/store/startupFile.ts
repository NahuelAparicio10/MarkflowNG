import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openFileAtPath } from "./openFile";
import { useSessionStore } from "./session";
import { markStartup } from "../startupTiming";

interface StartupFilePayload {
	path: string | null;
	error: string | null;
}

async function consumeStartupFile({ path, error }: StartupFilePayload): Promise<void> {
	if (path) await openFileAtPath(path);
	else if (error) useSessionStore.getState().setError(error);
}

/** Listen first, then drain queued OS activations so no second-instance event is lost. */
export async function openStartupFile(): Promise<void> {
	try {
		await listen<StartupFilePayload>("open-markdown-file", (event) => {
			void consumeStartupFile(event.payload);
		});
		const queued = await invoke<StartupFilePayload[]>("startup_files");
		markStartup("startup-file-authorized");
		for (const file of queued) await consumeStartupFile(file);
	} catch {
		// Plain-browser development has no Tauri command bridge.
	}
}

import { Channel, invoke } from "@tauri-apps/api/core";
import type { ScanSummary, WatchBatch, WorkspaceEntry } from "./types";

/**
 * The workspace's filesystem side: scanning and watching, both done in Rust
 * (design decision D1). Behind an interface so the dev/e2e hatch and unit
 * tests can swap in an in-memory implementation — the same reason
 * `src/editor/fs.ts` has a hatch — since neither runs inside Tauri.
 */
export interface WorkspaceBackend {
	/**
	 * Scans `root`, handing entries to `onChunk` as they are found, and
	 * resolves once the scan is over. Rejects if `root` cannot be read.
	 */
	scan(root: string, onChunk: (entries: WorkspaceEntry[]) => void): Promise<ScanSummary>;
	/** Starts watching `root`, replacing any previous watch. */
	watch(root: string, onBatch: (batch: WatchBatch) => void): Promise<void>;
	unwatch(): Promise<void>;
}

interface ScanChunk {
	entries: WorkspaceEntry[];
}

export const tauriWorkspaceBackend: WorkspaceBackend = {
	scan(root, onChunk) {
		const channel = new Channel<ScanChunk>();
		channel.onmessage = (chunk) => onChunk(chunk.entries);
		return invoke<ScanSummary>("scan_workspace", { root, onChunk: channel });
	},

	watch(root, onBatch) {
		const channel = new Channel<WatchBatch>();
		channel.onmessage = onBatch;
		return invoke<void>("start_watching", { root, onBatch: channel });
	},

	unwatch() {
		return invoke<void>("stop_watching");
	},
};

let backend: WorkspaceBackend = tauriWorkspaceBackend;

export function getWorkspaceBackend(): WorkspaceBackend {
	return backend;
}

/** Dev/e2e and tests only. */
export function setWorkspaceBackend(replacement: WorkspaceBackend): void {
	backend = replacement;
}

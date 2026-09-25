import { open } from "@tauri-apps/plugin-dialog";
import { useSessionStore } from "../store/session";
import { useWorkspaceStore } from "../store/workspace";
import { getWorkspaceBackend } from "./backend";
import { applyExternalChanges } from "./externalChanges";
import type { WatchBatch } from "./types";

/**
 * Bumped on every workspace opened, so scan chunks and watcher batches still
 * in flight for a previous folder are recognised and dropped.
 */
let currentGeneration = 0;

/**
 * Opens the native folder dialog and makes the chosen folder the workspace.
 * `recursive` has the dialog grant the fs scope to everything beneath it, so
 * files opened from the tree are readable and writable without a dialog of
 * their own. Cancelling leaves the current workspace, if any, untouched.
 */
export async function openFolderDialog(): Promise<void> {
	const selected = await open({ directory: true, recursive: true, multiple: false });

	if (!selected || Array.isArray(selected)) {
		return;
	}

	await openWorkspace(selected);
}

/**
 * Makes `root` the workspace: starts the watcher, then scans. The tree fills
 * in chunk by chunk while the scan runs (design decision D8), and the window
 * stays usable throughout. Watching starts first so that nothing changing
 * during the scan is missed; both feed the same upsert-style listing, so the
 * order they land in does not matter.
 *
 * A folder that cannot be read is reported through the session store's
 * `error` and leaves no workspace open; subfolders that cannot be read are
 * reported, and the rest of the workspace still opens.
 */
export async function openWorkspace(root: string): Promise<void> {
	const generation = ++currentGeneration;
	const isCurrent = () => generation === currentGeneration;
	const backend = getWorkspaceBackend();
	const workspace = useWorkspaceStore.getState();

	workspace.beginWorkspace(root);

	try {
		await backend.watch(root, (batch) => {
			if (isCurrent()) {
				void handleWatchBatch(root, batch);
			}
		});

		const summary = await backend.scan(root, (entries) => {
			if (isCurrent()) {
				useWorkspaceStore.getState().addEntries(entries);
			}
		});

		if (!isCurrent()) {
			return;
		}

		useWorkspaceStore.getState().finishScan(summary);
		if (summary.failures.length > 0) {
			const folders = summary.failures.map((failure) => failure.path || root).join(", ");
			useSessionStore.getState().setError(`Some folders could not be read and are not listed: ${folders}`);
		}
	} catch (error) {
		if (!isCurrent()) {
			return;
		}

		useWorkspaceStore.getState().closeWorkspace();
		void backend.unwatch().catch(() => {});
		const message = error instanceof Error ? error.message : String(error);
		useSessionStore.getState().setError(`Could not open folder "${root}": ${message}`);
	}
}

/** Stops watching and forgets the workspace. Open documents stay open. */
export async function closeWorkspace(): Promise<void> {
	currentGeneration++;
	useWorkspaceStore.getState().closeWorkspace();
	await getWorkspaceBackend()
		.unwatch()
		.catch(() => {});
}

/**
 * Applies a watcher batch: incrementally to the listing the tree and quick
 * open read, and to any open documents it touched.
 */
export async function handleWatchBatch(root: string, batch: WatchBatch): Promise<void> {
	useWorkspaceStore.getState().applyChanges(batch.changes);
	await applyExternalChanges(root, batch.changes);
}

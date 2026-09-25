import {
	exists as tauriExists,
	mkdir as tauriMkdir,
	readFile as tauriReadFile,
	readTextFile as tauriReadTextFile,
	remove as tauriRemove,
	rename as tauriRename,
	writeFile as tauriWriteFile,
	writeTextFile as tauriWriteTextFile,
} from "@tauri-apps/plugin-fs";

/**
 * The filesystem the editor's load and save paths use.
 *
 * `@tauri-apps/plugin-fs` only works inside the real Tauri webview. In dev
 * builds, `installEditorFsHatch` swaps in an in-memory filesystem so
 * Playwright — which drives the plain Vite dev server, not a built Tauri
 * binary, exactly like `devFixtureHatch.ts` for the reader — can exercise
 * the real load/save path end to end without OS file access. Production
 * and `tauri:dev` never install it, so this module talks to the real
 * plugin there.
 */
let devFiles: Map<string, string | Uint8Array> | null = null;

/** Dev/e2e only. Installs or resets the in-memory filesystem. */
export function installEditorFsHatch(initial: Record<string, string>): void {
	if (!import.meta.env.DEV) {
		return;
	}

	devFiles = new Map(Object.entries(initial));
}

/** Dev/e2e only. Reads back the text the hatch currently holds for `path`. */
export function readEditorFsHatch(path: string): string | undefined {
	const content = devFiles?.get(path);
	return typeof content === "string" ? content : undefined;
}

/** Dev/e2e only. Whether the hatch holds any file, text or binary, at `path`. */
export function hasEditorFsHatchFile(path: string): boolean {
	return devFiles?.has(path) ?? false;
}

export async function readTextFile(path: string): Promise<string> {
	if (devFiles) {
		const content = devFiles.get(path);
		if (content === undefined) {
			throw new Error(`No such file in the dev filesystem hatch: ${path}`);
		}
		return typeof content === "string" ? content : new TextDecoder().decode(content);
	}

	return tauriReadTextFile(path);
}

/** Reads a binary file, such as an image a document references. */
export async function readFile(path: string): Promise<Uint8Array> {
	if (devFiles) {
		const content = devFiles.get(path);
		if (content === undefined) {
			throw new Error(`No such file in the dev filesystem hatch: ${path}`);
		}
		return typeof content === "string" ? new TextEncoder().encode(content) : content;
	}

	return tauriReadFile(path);
}

export async function exists(path: string): Promise<boolean> {
	if (devFiles) {
		return devFiles.has(path);
	}

	return tauriExists(path);
}

export async function writeTextFile(path: string, data: string): Promise<void> {
	if (devFiles) {
		devFiles.set(path, data);
		return;
	}

	return tauriWriteTextFile(path, data);
}

export async function writeFile(path: string, data: Uint8Array): Promise<void> {
	if (devFiles) {
		devFiles.set(path, data);
		return;
	}

	return tauriWriteFile(path, data);
}

/**
 * Creates a directory and any missing parents. The in-memory hatch has no
 * directories, only paths, so there it does nothing.
 */
export async function mkdir(path: string): Promise<void> {
	if (devFiles) {
		return;
	}

	return tauriMkdir(path, { recursive: true });
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
	if (devFiles) {
		const content = devFiles.get(oldPath);
		if (content === undefined) {
			throw new Error(`No such file in the dev filesystem hatch: ${oldPath}`);
		}
		devFiles.delete(oldPath);
		devFiles.set(newPath, content);
		return;
	}

	return tauriRename(oldPath, newPath);
}

export async function remove(path: string): Promise<void> {
	if (devFiles) {
		devFiles.delete(path);
		return;
	}

	await tauriRemove(path).catch(() => {});
}

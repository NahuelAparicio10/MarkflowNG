/**
 * Workspace paths cross the bridge relative to the root with `/` separators;
 * documents are opened by absolute path in the platform's own form. These
 * convert between the two, using whichever separator the root already uses,
 * so a Windows root keeps producing Windows paths.
 */

function separatorOf(root: string): string {
	return root.includes("\\") && !root.includes("/") ? "\\" : "/";
}

/** Absolute path of the workspace entry `relative`. */
export function joinWorkspacePath(root: string, relative: string): string {
	const separator = separatorOf(root);
	const trimmedRoot = root.endsWith(separator) ? root.slice(0, -1) : root;
	return `${trimmedRoot}${separator}${relative.split("/").join(separator)}`;
}

/**
 * `absolute` relative to `root` with `/` separators, or `null` if it is not
 * inside the workspace.
 */
export function toWorkspaceRelative(root: string, absolute: string): string | null {
	const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
	const normalized = absolute.replace(/\\/g, "/");
	const prefix = `${normalizedRoot}/`;

	return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : null;
}

/** Whether `path` is `ancestor` or lies inside it; both relative. */
export function isSameOrInside(path: string, ancestor: string): boolean {
	return path === ancestor || path.startsWith(`${ancestor}/`);
}

export function baseName(relative: string): string {
	const index = relative.lastIndexOf("/");
	return index < 0 ? relative : relative.slice(index + 1);
}

/** The parent folder of `relative`, or `""` for a top-level entry. */
export function parentPath(relative: string): string {
	const index = relative.lastIndexOf("/");
	return index < 0 ? "" : relative.slice(0, index);
}

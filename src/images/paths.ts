/**
 * How image references relate to files on disk — design decision D5.
 *
 * A reference is stored relative to the document's own directory when its
 * target lies inside the workspace, so the document keeps working when the
 * repository is cloned elsewhere or the workspace is moved. Targets outside
 * the workspace, and absolute URLs, are stored as given.
 *
 * Everything here is string manipulation, with no file system access, so the
 * rules can be tested directly. Paths are compared with `/` separators; a
 * Windows path keeps its drive letter and is otherwise treated the same way.
 */

/** A reference with a URL scheme (`https:`, `data:`…) or protocol-relative. */
const EXTERNAL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

/** A Windows drive letter, which looks like a URL scheme to the pattern above. */
const DRIVE_PATTERN = /^[a-z]:[\\/]/i;

/** Whether `reference` points somewhere other than the local file system. */
export function isExternalReference(reference: string): boolean {
	return EXTERNAL_PATTERN.test(reference) && !DRIVE_PATTERN.test(reference);
}

function toSlashes(path: string): string {
	return path.replace(/\\/g, "/");
}

/** Whether `path` is absolute: rooted at `/` or at a drive letter. */
export function isAbsolutePath(path: string): boolean {
	return path.startsWith("/") || path.startsWith("\\") || DRIVE_PATTERN.test(path);
}

/** The directory containing `path`, with `/` separators. */
export function directoryOf(path: string): string {
	const normalized = toSlashes(path);
	const index = normalized.lastIndexOf("/");

	return index < 0 ? "" : normalized.slice(0, index);
}

/** Splits into segments, resolving `.` and `..` the way a file system would. */
function segmentsOf(path: string): string[] {
	const result: string[] = [];

	for (const segment of toSlashes(path).split("/")) {
		if (segment === "" || segment === ".") {
			continue;
		}
		if (segment === ".." && result.length > 0 && result[result.length - 1] !== "..") {
			result.pop();
			continue;
		}
		result.push(segment);
	}

	return result;
}

/** A drive letter compares case-insensitively; the rest of a path does not. */
function sameSegment(a: string, b: string, index: number): boolean {
	return index === 0 && /^[a-z]:$/i.test(a) ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function joinAbsolute(segments: string[], likeRootOf: string): string {
	const leading = DRIVE_PATTERN.test(likeRootOf) ? "" : "/";

	return `${leading}${segments.join("/")}`;
}

/**
 * Decodes percent-escapes, as a browser would when following the reference.
 * A malformed escape is left as written rather than failing the lookup.
 */
function decodeReference(reference: string): string {
	try {
		return decodeURI(reference);
	} catch {
		return reference;
	}
}

/**
 * The absolute file path a local reference points to, resolved against the
 * directory of the document containing it. Absolute references resolve to
 * themselves. `null` for an external reference, which is not a file path.
 */
export function resolveReference(documentPath: string, reference: string): string | null {
	if (isExternalReference(reference)) {
		return null;
	}

	const target = decodeReference(reference.split(/[?#]/)[0]);

	if (isAbsolutePath(target)) {
		return joinAbsolute(segmentsOf(target), target);
	}

	const base = directoryOf(documentPath);

	return joinAbsolute(segmentsOf(`${base}/${target}`), documentPath);
}

/** Whether absolute `path` is `root` or lies inside it. */
export function isInside(path: string, root: string): boolean {
	const pathSegments = segmentsOf(path);
	const rootSegments = segmentsOf(root);

	return (
		rootSegments.length <= pathSegments.length &&
		rootSegments.every((segment, index) => sameSegment(segment, pathSegments[index], index))
	);
}

/** `target` relative to directory `from`, with `/` separators; both absolute. */
export function relativePath(from: string, target: string): string {
	const fromSegments = segmentsOf(from);
	const targetSegments = segmentsOf(target);

	let common = 0;
	while (
		common < fromSegments.length &&
		common < targetSegments.length &&
		sameSegment(fromSegments[common], targetSegments[common], common)
	) {
		common++;
	}

	const up = fromSegments.slice(common).map(() => "..");

	return [...up, ...targetSegments.slice(common)].join("/");
}

/**
 * The boundary inside which references are stored relative: the open
 * workspace when the document belongs to it, otherwise the document's own
 * directory, which is the nearest thing a lone file has to a workspace.
 */
export function workspaceBoundary(documentPath: string, workspaceRoot: string | null): string {
	if (workspaceRoot !== null && isInside(documentPath, workspaceRoot)) {
		return workspaceRoot;
	}

	return directoryOf(documentPath);
}

/**
 * The reference to store for a newly inserted image at `target` — an
 * absolute file path or a URL. See D5 and the module comment.
 */
export function referenceFor(documentPath: string, target: string, workspaceRoot: string | null): string {
	if (isExternalReference(target) || !isAbsolutePath(target)) {
		return target;
	}

	if (!isInside(target, workspaceBoundary(documentPath, workspaceRoot))) {
		return target;
	}

	return relativePath(directoryOf(documentPath), target);
}

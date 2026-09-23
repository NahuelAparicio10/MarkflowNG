/**
 * What the application itself last put on (or read from) disk, per path —
 * how the watcher's events are told apart from genuine external changes
 * (design decision D5).
 *
 * The save path records the target path and a hash of the content it is about
 * to write, before writing. When the watcher later reports that path changed,
 * the file is read and hashed: if it matches, the change was the
 * application's own. Content, not timing, decides — so a genuine external
 * write landing in the middle of a save is still caught, and the watcher never
 * needs to be paused around a write.
 *
 * Content read at load time is recorded too, so an event that leaves a file's
 * bytes untouched (a `touch`, a formatter that changes nothing) is not
 * mistaken for an edit either.
 */
const knownHashes = new Map<string, number>();

function keyOf(path: string): string {
	return path.replace(/\\/g, "/");
}

/** Records content the application is about to write to `path`. */
export function recordSelfWrite(path: string, text: string): void {
	knownHashes.set(keyOf(path), hashText(text));
}

/** Records content the application just read from `path`. */
export function recordLoadedContent(path: string, text: string): void {
	knownHashes.set(keyOf(path), hashText(text));
}

/** Whether `text`, as now on disk at `path`, is what the application last wrote or read there. */
export function isKnownContent(path: string, text: string): boolean {
	return knownHashes.get(keyOf(path)) === hashText(text);
}

/** Drops the record for a document that is no longer open. */
export function forgetKnownContent(path: string): void {
	knownHashes.delete(keyOf(path));
}

/**
 * cyrb53: a fast, well-distributed 53-bit string hash. Not cryptographic —
 * it only has to tell one version of a document from another, and a
 * collision would at worst hide one external change.
 */
export function hashText(text: string): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;

	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}

	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

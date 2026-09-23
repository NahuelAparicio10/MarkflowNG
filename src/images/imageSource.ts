import { readFile } from "../editor/fs";
import { isExternalReference, resolveReference } from "./paths";

/**
 * Turns an image reference into something an `<img>` can display.
 *
 * External references are used as they are. A local file is read through the
 * same file system layer the documents use, and shown through a blob URL: it
 * stays within the fs scope the user already granted by opening the document
 * or workspace, needs no separate asset-protocol configuration, and works in
 * the in-memory file system the e2e suite runs against.
 *
 * Blob URLs are cached per file for the life of the window, so re-rendering a
 * document does not re-read its images. They are not revoked: a document's
 * images are few and small next to the document itself, and revoking while an
 * editor or reader may still show the image would blank it.
 */

const UNSAFE_URL_PATTERN = /^\s*javascript:/i;

const MIME_BY_EXTENSION: Record<string, string> = {
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	bmp: "image/bmp",
	avif: "image/avif",
};

const cache = new Map<string, Promise<string>>();

function mimeTypeOf(path: string): string {
	const extension = /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase() ?? "";

	// An SVG served without its type renders as nothing; the rest sniff fine.
	return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

async function loadLocal(path: string): Promise<string> {
	const data = await readFile(path);
	// Copied into a fresh ArrayBuffer so the Blob never aliases a view the file
	// layer might reuse.
	const blob = new Blob([data.slice()], { type: mimeTypeOf(path) });

	return URL.createObjectURL(blob);
}

/** The URL to display for `reference`, or `null` when it is unsafe to load. */
export function externalSource(reference: string): string | null {
	if (UNSAFE_URL_PATTERN.test(reference)) {
		return null;
	}

	return isExternalReference(reference) ? reference : null;
}

/**
 * Resolves `reference`, relative to `documentPath`, to a displayable URL.
 * Rejects when the file cannot be read — missing, or outside the granted
 * scope — which callers show as a placeholder.
 */
export function loadImageSource(documentPath: string | null, reference: string): Promise<string> {
	if (UNSAFE_URL_PATTERN.test(reference)) {
		return Promise.reject(new Error("Unsafe image reference"));
	}

	const external = externalSource(reference);
	if (external !== null) {
		return Promise.resolve(external);
	}

	const path = documentPath === null ? null : resolveReference(documentPath, reference);
	if (path === null) {
		return Promise.reject(new Error(`Cannot resolve image reference: ${reference}`));
	}

	let pending = cache.get(path);
	if (!pending) {
		pending = loadLocal(path);
		cache.set(path, pending);
		// A failed read is not cached, so an image added later is picked up.
		pending.catch(() => cache.delete(path));
	}

	return pending;
}

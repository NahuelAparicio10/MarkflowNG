import { exists, mkdir, writeFile } from "../editor/fs";
import { directoryOf, resolveReference } from "./paths";

/**
 * Where pasted and dropped image data is written — design decision D6, and
 * the open question on its layout, resolved: a single `assets` directory next
 * to the document, shared by every document in that directory, holding files
 * named after the moment they were added. One predictable place, which
 * matches the most common convention in repositories, and a name that sorts
 * chronologically and never needs the user to choose one mid-paste.
 */
export const ASSETS_DIRECTORY = "assets";

const EXTENSION_BY_MIME: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/svg+xml": "svg",
	"image/bmp": "bmp",
	"image/avif": "avif",
};

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

/** Whether a file name has an extension the editor displays as an image. */
export function hasImageExtension(name: string): boolean {
	const extension = /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase();

	return extension !== undefined && IMAGE_EXTENSIONS.includes(extension);
}

function extensionFor(mimeType: string, fileName: string | undefined): string {
	const fromName = fileName ? /\.([^./\\]+)$/.exec(fileName)?.[1]?.toLowerCase() : undefined;
	if (fromName && IMAGE_EXTENSIONS.includes(fromName)) {
		return fromName;
	}

	return EXTENSION_BY_MIME[mimeType] ?? "png";
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/** `image-20260923-163045`: sortable, and readable in a diff. */
function timestampName(date: Date): string {
	const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
	const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

	return `image-${day}-${time}`;
}

export interface WrittenAsset {
	/** The reference to store in the document, relative to its directory. */
	reference: string;
	/** Where the file was written, for telling the user. */
	path: string;
}

/**
 * Writes image data into the assets directory beside `documentPath` and
 * returns the reference to insert. Never overwrites: a name already taken
 * gets a numeric suffix.
 */
export async function writeImageAsset(
	documentPath: string,
	data: Uint8Array,
	mimeType: string,
	fileName?: string,
	now: Date = new Date(),
): Promise<WrittenAsset> {
	const extension = extensionFor(mimeType, fileName);
	const stem = timestampName(now);
	const directory = resolveReference(documentPath, ASSETS_DIRECTORY) ?? `${directoryOf(documentPath)}/${ASSETS_DIRECTORY}`;

	await mkdir(directory);

	for (let attempt = 1; ; attempt++) {
		const name = attempt === 1 ? `${stem}.${extension}` : `${stem}-${attempt}.${extension}`;
		const reference = `${ASSETS_DIRECTORY}/${name}`;
		const path = `${directory}/${name}`;

		if (await exists(path)) {
			continue;
		}

		await writeFile(path, data);
		return { reference, path };
	}
}

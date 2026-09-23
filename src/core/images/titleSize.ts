/**
 * The display-size encoding in an image's title field — design decision D7.
 *
 * Markdown has no size attribute, so a resized image carries its width in
 * the title, which GFM does keep and other renderers show as a harmless
 * tooltip:
 *
 *     ![Diagram](diagram.png "width=480")
 *     ![Diagram](diagram.png "Build pipeline | width=480")
 *
 * The encoding is deliberately strict — one exact separator, no leading
 * zeros — so that decoding and re-encoding is the identity on every title it
 * accepts. A title that is merely close to the form, such as `"a |width=480"`,
 * is not decoded at all and so travels through unchanged. That is what keeps
 * the "existing references are never rewritten" guarantee.
 *
 * This is the weakest decision of the change and is confined to this module
 * and the image handler, so withdrawing it later touches nothing else.
 */

const SIZE_PATTERN = /^(?:(.+) \| )?width=([1-9]\d*)$/s;

export interface DecodedTitle {
	/** The title with the size removed, or `null` when nothing else is left. */
	title: string | null;
	/** The encoded display width in CSS pixels, or `null` when never resized. */
	width: number | null;
}

/** Splits a stored title into its human part and its encoded display width. */
export function decodeTitle(stored: string | null | undefined): DecodedTitle {
	if (stored == null) {
		return { title: null, width: null };
	}

	const match = SIZE_PATTERN.exec(stored);
	if (!match) {
		return { title: stored, width: null };
	}

	const width = Number(match[2]);
	// Beyond the safe integer range, `Number` would not re-encode to the same
	// digits; such a title is left as a foreign one.
	if (!Number.isSafeInteger(width)) {
		return { title: stored, width: null };
	}

	return { title: match[1] ?? null, width };
}

/** The inverse of `decodeTitle`. An image with no width gains nothing. */
export function encodeTitle(title: string | null, width: number | null): string | null {
	if (width === null) {
		return title;
	}

	const size = `width=${Math.round(width)}`;

	return title === null || title === "" ? size : `${title} | ${size}`;
}

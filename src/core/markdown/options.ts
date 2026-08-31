import type { Options as StringifyOptions } from "remark-stringify";

/**
 * The single definition of the serializer normal form.
 *
 * The round-trip invariant is defined against a normalization: parsing and
 * re-serializing a document reproduces it byte for byte only when that document
 * is already in this form. If call sites could vary these options, "normal form"
 * would not be well defined and the invariant would be untestable.
 *
 * See design decision D4 of the markdown-core-roundtrip change. Nothing outside
 * this directory may pass its own serializer options.
 */
export const STRINGIFY_OPTIONS: Readonly<StringifyOptions> = Object.freeze({
	bullet: "-",
	emphasis: "*",
	strong: "*",
	fence: "`",
	fences: true,
	rule: "-",
	listItemIndent: "one",
	incrementListMarker: true,
} satisfies StringifyOptions);

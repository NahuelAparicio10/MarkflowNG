import type { Image } from "mdast";
import { decodeTitle, encodeTitle } from "../../images/titleSize";
import { defineNodeHandler } from "../registry";

/**
 * The reference is carried verbatim: the handler never resolves, normalizes
 * or rewrites `url`, so opening and saving a document leaves every image
 * reference byte-identical — see the "Existing references are not rewritten"
 * scenario. Path handling applies only when an image is inserted, in the
 * editor.
 *
 * The title is split into its human part and an encoded display width, and
 * joined back on the way out; see `titleSize.ts` for why that is lossless.
 */
export const imageHandler = defineNodeHandler<Image>({
	mdastType: "image",
	pmType: "image",

	toPm(node, { schema }) {
		const { title, width } = decodeTitle(node.title);

		return [schema.node("image", { src: node.url, alt: node.alt ?? "", title, width })];
	},

	toMdast(node) {
		return [
			{
				type: "image",
				url: node.attrs.src as string,
				alt: node.attrs.alt as string,
				title: encodeTitle(node.attrs.title as string | null, node.attrs.width as number | null),
			},
		];
	},
});

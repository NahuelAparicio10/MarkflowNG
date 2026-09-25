import type { Link, PhrasingContent } from "mdast";
import { defineNodeHandler } from "../registry";
import { addMark } from "./phrasing";

export const linkHandler = defineNodeHandler<Link>({
	mdastType: "link",
	pmType: "link",

	toPm(node, { schema, convertChildren }) {
		const mark = schema.marks.link.create({ href: node.url, title: node.title ?? null });

		return addMark(convertChildren(node, true), mark);
	},

	toMdast(node, { convertChildren }) {
		// A node carries at most one link, since a mark type excludes itself.
		const mark = node.marks.find((candidate) => candidate.type.name === "link");

		return [
			{
				type: "link",
				url: (mark?.attrs.href as string | undefined) ?? "",
				title: (mark?.attrs.title as string | null | undefined) ?? null,
				children: convertChildren(node) as PhrasingContent[],
			},
		];
	},
});

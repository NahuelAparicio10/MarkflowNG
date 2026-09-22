import type { Root } from "mdast";
import type { ReactNode } from "react";
import { deriveOutline, type Outline } from "./outline";
import { renderNode } from "./renderNode";

/**
 * Renders an mdast tree as React output. Pure: no side effects, no editing
 * engine mounted, and the input tree is never mutated.
 *
 * `outline` is accepted rather than always recomputed so a caller that already
 * derived it (the session store, for the outline panel) does not pay for it
 * twice; it defaults to deriving its own, which keeps this callable with just
 * a tree, as node coverage tests do.
 */
export function renderMdast(tree: Root, outline: Outline = deriveOutline(tree)): ReactNode {
	return renderNode(tree, 0, { headingIds: outline.idsByHeading });
}

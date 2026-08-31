import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import type { Parent, RootContent } from "mdast";

/** Everything a handler needs to recurse without importing the walkers. */
export interface MdastToPmContext {
	schema: Schema;
	/**
	 * Converts the children of an mdast parent. `inline` says whether the
	 * parent holds phrasing content, which decides whether an unsupported
	 * child is preserved as a block or as an inline node.
	 */
	convertChildren(parent: Parent, inline?: boolean): PmNode[];
	/** Converts a single mdast node, dispatching through the registry. */
	convertNode(node: RootContent, inline?: boolean): PmNode[];
}

export interface PmToMdastContext {
	/** Converts the children of a ProseMirror node, for handlers with content. */
	convertChildren(node: PmNode): RootContent[];
	/** Converts a single ProseMirror node, dispatching through the registry. */
	convertNode(node: PmNode): RootContent[];
}

/**
 * Converts one mdast node into zero or more ProseMirror nodes.
 *
 * Returning an array rather than a single node lets a handler flatten or expand
 * where the two models disagree about nesting, without the walker needing to
 * know which handlers do that.
 */
export type MdastToPmHandler<T extends RootContent = RootContent> = (
	node: T,
	context: MdastToPmContext,
) => PmNode[];

/** Converts one ProseMirror node into zero or more mdast nodes. */
export type PmToMdastHandler = (node: PmNode, context: PmToMdastContext) => RootContent[];

/**
 * A node type's handler pair. Registering both directions together is what
 * makes a half-supported node type impossible to introduce by accident: there
 * is no way to register only one side.
 */
export interface NodeHandlerPair<T extends RootContent = RootContent> {
	/** The mdast node type this pair converts, for example `heading`. */
	mdastType: T["type"];
	/** The ProseMirror node type this pair converts, for example `heading`. */
	pmType: string;
	toPm: MdastToPmHandler<T>;
	toMdast: PmToMdastHandler;
}

export interface MappingRegistry {
	byMdastType: ReadonlyMap<string, NodeHandlerPair>;
	byPmType: ReadonlyMap<string, NodeHandlerPair>;
}

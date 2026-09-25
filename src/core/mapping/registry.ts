import type { RootContent } from "mdast";
import type { MappingRegistry, NodeHandlerPair } from "./types";

/**
 * Declares a handler pair, narrowly typed to the mdast node it converts while
 * storing as the widened type the registry holds.
 *
 * The widening is sound because dispatch is keyed by `mdastType`: a handler is
 * only ever invoked with a node of the type it declared. Doing it here means no
 * handler module and no composition site needs a cast of its own.
 */
export function defineNodeHandler<T extends RootContent>(
	pair: NodeHandlerPair<T>,
): NodeHandlerPair {
	return pair as unknown as NodeHandlerPair;
}

/**
 * Builds the mapping registry from a list of handler pairs.
 *
 * Handlers are registered as pairs rather than as two independent tables so
 * that a node type supported in only one direction cannot be expressed. Later
 * changes add support for a node type by contributing a pair from their own
 * module; no file here needs to change.
 */
export function createRegistry(pairs: readonly NodeHandlerPair[]): MappingRegistry {
	const byMdastType = new Map<string, NodeHandlerPair>();
	const byPmType = new Map<string, NodeHandlerPair>();

	for (const pair of pairs) {
		if (byMdastType.has(pair.mdastType)) {
			throw new Error(`Duplicate handler for mdast type: ${pair.mdastType}`);
		}
		if (byPmType.has(pair.pmType)) {
			throw new Error(`Duplicate handler for ProseMirror type: ${pair.pmType}`);
		}

		byMdastType.set(pair.mdastType, pair);
		byPmType.set(pair.pmType, pair);
	}

	return { byMdastType, byPmType };
}

export function findByMdastType(
	registry: MappingRegistry,
	type: RootContent["type"],
): NodeHandlerPair | undefined {
	return registry.byMdastType.get(type);
}

export function findByPmType(
	registry: MappingRegistry,
	type: string,
): NodeHandlerPair | undefined {
	return registry.byPmType.get(type);
}

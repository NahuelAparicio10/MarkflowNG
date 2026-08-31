import { schema } from "../schema";
import { headingHandler } from "./handlers/heading";
import { paragraphHandler } from "./handlers/paragraph";
import { textHandler } from "./handlers/text";
import { createMdastToPm } from "./mdastToPm";
import { createPmToMdast } from "./pmToMdast";
import { createRegistry } from "./registry";
import type { NodeHandlerPair } from "./types";

/**
 * The composition point for the mapping.
 *
 * Adding support for a node type means writing a handler pair in its own module
 * and adding it to this list. Nothing else under `src/core/mapping/` changes.
 */
const handlerPairs: NodeHandlerPair[] = [textHandler, paragraphHandler, headingHandler];

export const registry = createRegistry(handlerPairs);

export const mdastToPm = createMdastToPm(registry, schema);
export const pmToMdast = createPmToMdast(registry);

export { createMdastToPm } from "./mdastToPm";
export { createPmToMdast } from "./pmToMdast";
export { createRegistry, findByMdastType, findByPmType } from "./registry";
export type {
	MappingRegistry,
	MdastToPmHandler,
	NodeHandlerPair,
	PmToMdastHandler,
} from "./types";

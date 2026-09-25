import { schema } from "../schema";
import { blockquoteHandler } from "./handlers/blockquote";
import { codeBlockHandler } from "./handlers/codeBlock";
import { emphasisHandler } from "./handlers/emphasis";
import { createHeadingHandler } from "./handlers/heading";
import { imageHandler } from "./handlers/image";
import { inlineCodeHandler } from "./handlers/inlineCode";
import { linkHandler } from "./handlers/link";
import { listHandler } from "./handlers/list";
import { listItemHandler } from "./handlers/listItem";
import { createParagraphHandler } from "./handlers/paragraph";
import type { HandlerLookup } from "./handlers/phrasing";
import { strikethroughHandler } from "./handlers/strikethrough";
import { strongHandler } from "./handlers/strong";
import {
	createTableCellHandler,
	createTableHeaderHandler,
	tableHandler,
	tableRowHandler,
} from "./handlers/table";
import { textHandler } from "./handlers/text";
import { thematicBreakHandler } from "./handlers/thematicBreak";
import { createMdastToPm } from "./mdastToPm";
import { createPmToMdast } from "./pmToMdast";
import { createRegistry } from "./registry";
import type { NodeHandlerPair } from "./types";

/**
 * Textblocks rebuild mark nesting from the mark handlers registered below. The
 * lookup is resolved at call time, so it can close over the registry it is
 * itself part of.
 */
const lookup: HandlerLookup = (pmType) => registry.byPmType.get(pmType);

/**
 * The composition point for the mapping.
 *
 * Adding support for a node or mark type means writing a handler pair in its
 * own module and adding it to this list. Nothing else under
 * `src/core/mapping/` changes.
 */
const handlerPairs: NodeHandlerPair[] = [
	textHandler,
	createParagraphHandler(lookup),
	createHeadingHandler(lookup),
	strongHandler,
	emphasisHandler,
	strikethroughHandler,
	inlineCodeHandler,
	linkHandler,
	listHandler,
	listItemHandler,
	blockquoteHandler,
	codeBlockHandler,
	thematicBreakHandler,
	tableHandler,
	tableRowHandler,
	createTableHeaderHandler(lookup),
	createTableCellHandler(lookup),
	imageHandler,
];

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

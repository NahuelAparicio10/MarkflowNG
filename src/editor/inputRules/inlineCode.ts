import { markRule } from "./markRule";

/**
 * `` `text` ``. Unlike the other marks, code content may start or end with a
 * space, so it does not use the flanking pattern.
 */
export const inlineCodeRule = markRule("inlineCode", "inlineCode", /(?:^|[^`])(`([^`]+)`)$/, 1);

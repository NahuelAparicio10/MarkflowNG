import { delimitedPattern, markRule } from "./markRule";

/**
 * `*text*` and `_text_`. Listed after the strong rules, whose closing delimiter
 * would otherwise also close emphasis.
 */
export const emphasisRules = [
	markRule("emphasis", "emphasis", delimitedPattern("*", "*"), 1),
	markRule("emphasis-underscore", "emphasis", delimitedPattern("_", "_\\w"), 1),
];

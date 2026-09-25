import { delimitedPattern, markRule } from "./markRule";

/** `**text**` and `__text__`. */
export const strongRules = [
	markRule("strong", "strong", delimitedPattern("**", "*"), 2),
	markRule("strong-underscore", "strong", delimitedPattern("__", "_\\w"), 2),
];

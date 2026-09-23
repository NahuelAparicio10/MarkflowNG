import { delimitedPattern, markRule } from "./markRule";

/** `~~text~~`. */
export const strikethroughRule = markRule("strikethrough", "strikethrough", delimitedPattern("~~", "~"), 2);

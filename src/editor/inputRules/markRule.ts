import type { MarkdownInputRule } from "./types";

/**
 * A rule that turns delimited text into a mark once the closing delimiter is
 * typed. `pattern` must capture the whole delimited span as group 1 and the
 * content between the delimiters as group 2.
 */
export function markRule(name: string, markName: string, pattern: RegExp, delimiterLength: number): MarkdownInputRule {
	return {
		name,
		pattern,

		apply({ state, match, to }) {
			const markType = state.schema.marks[markName];
			const [, span, content] = match;
			const start = to - span.length;

			if (!state.doc.resolve(start).parent.type.allowsMarkType(markType)) {
				return null;
			}

			const tr = state.tr;
			tr.delete(to - delimiterLength, to);
			tr.delete(start, start + delimiterLength);
			tr.addMark(start, start + content.length, markType.create());
			// Text typed next continues unformatted, as it would after the
			// literal closing delimiter.
			tr.removeStoredMark(markType);

			return tr;
		},
	};
}

function escape(text: string): string {
	return text.replace(/[*~`_]/g, "\\$&");
}

/**
 * The pattern for text between a repeated delimiter, such as `**bold**`.
 *
 * Content may not start or end with whitespace, matching CommonMark flanking,
 * so `2 * 3 * 4` stays literal. `notBefore` is the character class the opening
 * delimiter may not follow — the delimiter character itself, so `**x*` does not
 * read as emphasis, plus word characters for `_`, so `snake_case_name` stays
 * literal.
 */
export function delimitedPattern(delimiter: string, notBefore: string): RegExp {
	const open = escape(delimiter);
	const char = escape(delimiter[0]);

	return new RegExp(`(?:^|[^${notBefore}])(${open}([^${char}\\s](?:[^${char}]*[^${char}\\s])?)${open})$`);
}

/**
 * The dirty flag is true exactly when the current document would serialize
 * to bytes different from those last written to disk — never merely
 * because a transaction occurred. See design decision D7.
 */
export function isDirty(currentText: string, baselineText: string): boolean {
	return currentText !== baselineText;
}

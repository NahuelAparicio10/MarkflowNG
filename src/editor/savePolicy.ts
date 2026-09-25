import type { ExternalConflict } from "../store/session";

export interface SaveCheck {
	/** The document's unanswered external-change conflict, if any. */
	conflict: ExternalConflict | null;
	/** What the document would serialize to now. */
	currentText: string;
	/** What was last read from or written to disk. */
	baselineText: string;
	/** Write even when nothing changed — re-creating a deleted file. */
	force?: boolean;
}

/**
 * Whether a save — autosave or explicit — may write. Two guards, in order:
 *
 * - While a conflict is unanswered nothing is written, whoever asks: the user
 *   has not chosen between the local and the disk version yet (the "Nothing
 *   is lost without a choice" scenario of the workspace-explorer change).
 * - A document that matches disk is never rewritten (the "Autosave skips
 *   clean documents" scenario), unless `force` says to.
 */
export function shouldWrite({ conflict, currentText, baselineText, force = false }: SaveCheck): boolean {
	if (conflict !== null) {
		return false;
	}

	return force || currentText !== baselineText;
}

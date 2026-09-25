import { ask } from "@tauri-apps/plugin-dialog";
import { forgetKnownContent } from "../explorer/selfWrites";
import { selectDocument, useSessionStore } from "../store/session";

/** Asks whether unsaved changes to `name` may be discarded. */
export type ConfirmDiscard = (name: string) => Promise<boolean>;

/**
 * The native confirmation dialog inside Tauri; the browser's own outside it
 * (the plain dev server that e2e tests drive), where the dialog plugin does
 * not exist.
 */
export const confirmDiscard: ConfirmDiscard = async (name) => {
	const message = `"${name}" has unsaved changes. Close it and discard them?`;

	if ("__TAURI_INTERNALS__" in window) {
		return ask(message, { title: "Unsaved changes", kind: "warning", okLabel: "Discard", cancelLabel: "Keep editing" });
	}

	return window.confirm(message);
};

/**
 * Closes a tab. A document with unsaved changes is only closed once the user
 * agrees to discard them; its pending autosave, if any, is cancelled when its
 * editor unmounts. Resolves with whether the tab was closed.
 */
export async function closeTab(path: string, confirm: ConfirmDiscard = confirmDiscard): Promise<boolean> {
	const document = selectDocument(useSessionStore.getState(), path);
	if (!document) {
		return false;
	}

	if (document.dirty && !(await confirm(document.name))) {
		return false;
	}

	useSessionStore.getState().closeDocument(path);
	forgetKnownContent(path);
	return true;
}

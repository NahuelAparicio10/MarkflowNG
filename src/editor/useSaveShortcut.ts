import { useEffect } from "react";
import { matchesShortcut } from "./shortcuts";

/**
 * Ctrl/Cmd+S saves immediately, bypassing the autosave debounce — see task
 * 3.3 and the "Explicit save is immediate" spec scenario. The binding itself is
 * declared in the shortcut table.
 */
export function useSaveShortcut(onSave: () => void, enabled: boolean): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (!matchesShortcut(event, "save")) {
				return;
			}

			event.preventDefault();
			onSave();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onSave, enabled]);
}

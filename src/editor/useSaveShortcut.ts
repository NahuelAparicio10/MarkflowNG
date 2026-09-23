import { useEffect } from "react";

/**
 * Ctrl/Cmd+S saves immediately, bypassing the autosave debounce — see task
 * 3.3 and the "Explicit save is immediate" spec scenario.
 */
export function useSaveShortcut(onSave: () => void, enabled: boolean): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			const isModifierPressed = event.metaKey || event.ctrlKey;
			if (!isModifierPressed || event.key.toLowerCase() !== "s") {
				return;
			}

			event.preventDefault();
			onSave();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onSave, enabled]);
}

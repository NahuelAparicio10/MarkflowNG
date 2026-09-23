import { useEffect } from "react";
import { matchesShortcut } from "../editor/shortcuts";

/**
 * Ctrl/Cmd+P invokes quick open while a workspace is open. The binding is
 * declared in the shortcut table. Registered in the capture phase so it is
 * seen before the editor's own key handling.
 */
export function useQuickOpenShortcut(onInvoke: () => void, enabled: boolean): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (!matchesShortcut(event, "quickOpen")) {
				return;
			}

			event.preventDefault();
			onInvoke();
		}

		window.addEventListener("keydown", handleKeyDown, true);
		return () => window.removeEventListener("keydown", handleKeyDown, true);
	}, [onInvoke, enabled]);
}

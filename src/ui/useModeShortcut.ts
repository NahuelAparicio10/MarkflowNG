import { useEffect } from "react";
import { matchesShortcut } from "../editor/shortcuts";
import { useSessionStore } from "../store/session";

/**
 * Ctrl/Cmd+E cycles the active document's view mode without reloading it. Only
 * reader ⇄ raw are reachable — see `SessionState.cycleMode`. The binding is
 * declared in the shortcut table, which matches modifiers exactly so that the
 * inline code shortcut, Ctrl/Cmd+Shift+E, does not also switch modes.
 */
export function useModeShortcut(): void {
	const cycleMode = useSessionStore((state) => state.cycleMode);
	const hasDocument = useSessionStore((state) => state.activePath !== null);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (!matchesShortcut(event, "cycleMode") || !hasDocument) {
				return;
			}

			event.preventDefault();
			cycleMode();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cycleMode, hasDocument]);
}

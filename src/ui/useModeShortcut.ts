import { useEffect } from "react";
import { useSessionStore } from "../store/session";

/**
 * Ctrl/Cmd+E cycles the view mode without reloading the document. Only
 * reader ⇄ raw are reachable — see `SessionState.cycleMode`.
 */
export function useModeShortcut(): void {
	const cycleMode = useSessionStore((state) => state.cycleMode);
	const hasDocument = useSessionStore((state) => state.tree !== null);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const isModifierPressed = event.metaKey || event.ctrlKey;
			if (!isModifierPressed || event.key.toLowerCase() !== "e" || !hasDocument) {
				return;
			}

			event.preventDefault();
			cycleMode();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cycleMode, hasDocument]);
}

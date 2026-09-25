import type { AiSuggestion } from "../editor/slashMenu/types";

/** Owns the pending interaction; document state stays in the editor. */
export function createReviewController(show: (suggestion: AiSuggestion | null) => void) {
	let finish: ((accepted: boolean) => void) | undefined;
	let visible = true;
	let generation = 0;
	return {
		setVisible(value: boolean) {
			visible = value;
			if (!visible) finish?.(false);
		},
		resolve(accepted: boolean) { finish?.(accepted); },
		async request(suggestion: AiSuggestion): Promise<boolean> {
			if (!visible) return false;
			const current = ++generation;
			finish?.(false);
			show(suggestion);
			const accepted = await new Promise<boolean>((resolve) => { finish = resolve; });
			if (current === generation) {
				finish = undefined;
				show(null);
			}
			return accepted;
		},
	};
}

export interface DebouncedAutosave {
	/** (Re)starts the delay. A call while already pending replaces it. */
	schedule(): void;
	/** Cancels a pending save, if any. */
	cancel(): void;
}

/**
 * Debounces autosave: each call to `schedule` restarts the delay, so a save
 * only fires after `delayMs` of inactivity, never while the user keeps
 * typing — see design decision D3.
 */
export function createDebouncedAutosave(save: () => void, delayMs: number): DebouncedAutosave {
	let timer: ReturnType<typeof setTimeout> | null = null;

	return {
		schedule() {
			if (timer !== null) {
				clearTimeout(timer);
			}

			timer = setTimeout(() => {
				timer = null;
				save();
			}, delayMs);
		},

		cancel() {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		},
	};
}

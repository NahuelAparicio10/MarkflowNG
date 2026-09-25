import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedAutosave } from "../autosave";

describe("createDebouncedAutosave", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("fires once after the delay elapses", () => {
		const save = vi.fn();
		const autosave = createDebouncedAutosave(save, 2000);

		autosave.schedule();
		vi.advanceTimersByTime(1999);
		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("does not fire while schedule keeps being called before the delay elapses", () => {
		const save = vi.fn();
		const autosave = createDebouncedAutosave(save, 2000);

		autosave.schedule();
		vi.advanceTimersByTime(1500);
		autosave.schedule();
		vi.advanceTimersByTime(1500);
		autosave.schedule();
		vi.advanceTimersByTime(1500);

		expect(save).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("cancel prevents a pending save from firing", () => {
		const save = vi.fn();
		const autosave = createDebouncedAutosave(save, 2000);

		autosave.schedule();
		autosave.cancel();
		vi.advanceTimersByTime(5000);

		expect(save).not.toHaveBeenCalled();
	});
});

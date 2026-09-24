import { expect, it, vi } from "vitest";
import { createReviewController } from "./reviewController";

it("rejects review when its editor is hidden and cannot reopen until visible", async () => {
	const show = vi.fn();
	const controller = createReviewController(show);
	const review = controller.request({ original: "Original", replacement: "Replacement" });
	controller.setVisible(false);
	expect(await review).toBe(false);
	expect(show).toHaveBeenLastCalledWith(null);
	show.mockClear();
	expect(await controller.request({ original: "Original", replacement: "Replacement" })).toBe(false);
	expect(show).not.toHaveBeenCalled();
});

it("replacing a review cannot let an older completion clear the new review", async () => {
	const show = vi.fn();
	const controller = createReviewController(show);
	const first = controller.request({ original: "Original", replacement: "First" });
	const second = controller.request({ original: "Original", replacement: "Second" });
	expect(await first).toBe(false);
	expect(show).toHaveBeenLastCalledWith({ original: "Original", replacement: "Second" });
	controller.resolve(true);
	expect(await second).toBe(true);
});

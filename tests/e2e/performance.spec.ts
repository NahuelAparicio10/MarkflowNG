import { expect, test } from "@playwright/test";

declare global {
	interface Window {
		__markflowLoadFixture?: (source: string) => void;
		__markflowLoadWorkspace?: (files: Record<string, string>) => Promise<void>;
	}
}

const enabled = process.env.MARKFLOW_RUN_PERF === "1";
test.skip(!enabled, "Set MARKFLOW_RUN_PERF=1 to run the opt-in performance evaluation.");

test("record large-document open and render", async ({ page }) => {
	await page.goto("/");
	const source = `# Performance evaluation\n\n${Array.from({ length: 10_000 }, (_, i) =>
		i % 20 === 0 ? `## Section ${i}\n\nA representative paragraph for the repeatable renderer benchmark.` :
			`Paragraph ${i}: a representative paragraph for the repeatable renderer benchmark.`).join("\n\n")}`;
	const started = await page.evaluate((markdown) => {
		if (!window.__markflowLoadFixture) throw new Error("Development fixture hatch unavailable");
		const start = performance.now();
		window.__markflowLoadFixture(markdown);
		(window as Window & { __markflowPerfStart?: number }).__markflowPerfStart = start;
		return start;
	}, source);
	await expect(page.locator(".markflow-reader h1")).toHaveText("Performance evaluation");
	const documentTiming = await page.evaluate((start) => ({
		milliseconds: performance.now() - start,
		blocks: document.querySelectorAll(".markflow-reader p, .markflow-reader h2").length,
		bytes: new TextEncoder().encode(document.querySelector(".markflow-reader")?.textContent ?? "").byteLength,
	}), started);
	console.log(`MARKFLOW_PERF_DOCUMENT ${JSON.stringify({ ...documentTiming, sourceBytes: new TextEncoder().encode(source).byteLength })}`);
	expect(documentTiming.blocks).toBeGreaterThan(9_000);
});

test("record large-workspace scan, quick-open, and editor responsiveness", async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto("/");
	const files = Object.fromEntries(Array.from({ length: 5_000 }, (_, index) => {
		const group = String(Math.floor(index / 50)).padStart(4, "0");
		return [`group-${group}/document-${String(index).padStart(5, "0")}.md`, `# Document ${index}\n\nPerformance fixture.`];
	}));
	const workspaceTiming = await page.evaluate(async (workspace) => {
		if (!window.__markflowLoadWorkspace) throw new Error("Development workspace hatch unavailable");
		let timerDelay = 0;
		const tick = performance.now();
		const timer = new Promise<void>((resolve) => setTimeout(() => { timerDelay = performance.now() - tick; resolve(); }, 0));
		const start = performance.now();
		await window.__markflowLoadWorkspace(workspace);
		await timer;
		return { scanAndTreeMilliseconds: performance.now() - start, eventLoopDelayMilliseconds: timerDelay };
	}, files);
	await expect(page.getByRole("tree", { name: "Workspace files" })).toBeVisible();
	console.log(`MARKFLOW_PERF_WORKSPACE ${JSON.stringify({ files: Object.keys(files).length, ...workspaceTiming })}`);
	await page.waitForTimeout(500);
	await page.keyboard.press("Control+p");
	const dialog = page.getByRole("dialog", { name: "Quick open" });
	await expect(dialog).toBeVisible();
	await page.locator(".markflow-quick-open input").fill("document-04999");
	const result = dialog.getByRole("option").first();
	await expect(result).toContainText("document-04999.md");
	await result.click();
	await page.getByRole("button", { name: "Edit document" }).click();
	await expect(page.locator(".ProseMirror")).toBeVisible();
});

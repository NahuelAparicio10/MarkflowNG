import { expect, test, type Page } from "@playwright/test";

// Same dev bypass as tests/e2e/formatting.spec.ts: the fixture hatch loads a
// document without the Tauri file dialog and backs save with an in-memory
// filesystem, so the saved Markdown can be read back and asserted on.
async function openInEditor(page: Page, source: string) {
	await page.goto("/");
	await page.evaluate((text) => window.__markflowLoadFixture?.(text), source);

	// reader -> raw -> editor
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");

	const editor = page.locator(".markflow-editor.ProseMirror");
	await expect(editor).toBeVisible();
	return editor;
}

const menu = (page: Page) => page.getByRole("listbox", { name: "Insert block" });

test("filter the slash menu, insert a table, and undo back to the typed text", async ({ page }) => {
	const editor = await openInEditor(page, "Intro.\n");

	await editor.locator("p", { hasText: "Intro." }).click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("/");

	await expect(menu(page)).toBeVisible();
	await expect(menu(page).getByRole("option", { name: "Table" })).toBeVisible();

	// "grid" is a keyword of the table entry, not part of its label.
	await page.keyboard.type("grid");
	await expect(menu(page).getByRole("option")).toHaveText(["Table"]);
	await expect(menu(page).getByRole("option", { name: "Table" })).toHaveAttribute("aria-selected", "true");

	await page.keyboard.press("Enter");

	await expect(menu(page)).toHaveCount(0);
	await expect(editor.locator("table")).toBeVisible();
	await expect(editor.locator("th")).toHaveCount(3);
	await expect(editor).not.toContainText("/grid");

	await page.keyboard.press("Control+z");

	await expect(editor.locator("table")).toHaveCount(0);
	await expect(editor.locator("p", { hasText: "/grid" })).toBeVisible();
	await expect(menu(page)).toHaveCount(0);
});

test("Escape closes the menu and leaves the slash as typed", async ({ page }) => {
	const editor = await openInEditor(page, "Intro.\n");

	await editor.locator("p", { hasText: "Intro." }).click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("/head");
	await expect(menu(page)).toBeVisible();

	await page.keyboard.press("Escape");

	await expect(menu(page)).toHaveCount(0);
	await expect(editor.locator("p", { hasText: "/head" })).toBeVisible();

	// Enter is an ordinary editor key again: it splits the paragraph.
	await page.keyboard.press("Enter");
	await expect(editor.locator("p")).toHaveCount(3);
});

test("a slash inside a sentence does not open the menu", async ({ page }) => {
	const editor = await openInEditor(page, "Intro.\n");

	await editor.locator("p", { hasText: "Intro." }).click();
	await page.keyboard.press("End");
	await page.keyboard.type(" See src/core/ for details.");

	await expect(menu(page)).toHaveCount(0);
	await expect(editor).toContainText("Intro. See src/core/ for details.");
});

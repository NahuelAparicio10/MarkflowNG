import { expect, test, type Page } from "@playwright/test";

// Same dev bypass as workspace.spec.ts: an in-memory workspace stands in for
// the folder dialog and the disk, so insertion, the assets directory, save and
// reopen all run their real code paths against memory.
const FILES = {
	"docs/balance.md": "# Balance\n\nWeapon stats:\n",
};

/** A 1×1 transparent PNG, so the dropped image really decodes and displays. */
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const treeItem = (page: Page, name: string) => page.getByRole("treeitem", { name, exact: true });
const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Insert and table controls" });
const editor = (page: Page) => page.locator(".markflow-editor.ProseMirror");

async function openInEditor(page: Page): Promise<void> {
	await treeItem(page, "docs").click();
	await treeItem(page, "balance.md").dblclick();
	await expect(page.locator(".markflow-reader h1")).toHaveText("Balance");
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");
	await expect(editor(page)).toBeVisible();
}

test("insert and edit a table, drop an image, save and reopen", async ({ page }) => {
	await page.goto("/");
	await page.evaluate((files) => window.__markflowLoadWorkspace?.(files), FILES);
	await openInEditor(page);

	// Put the caret after the intro line, then insert a table.
	await editor(page).locator("p", { hasText: "Weapon stats:" }).click();
	await page.keyboard.press("End");
	await page.waitForTimeout(600);
	await toolbar(page).getByRole("button", { name: "Table", exact: true }).click();

	const table = editor(page).locator("table");
	await expect(table).toBeVisible();
	await expect(table.locator("th")).toHaveCount(3);
	await expect(table.locator("tr")).toHaveCount(3);

	// Fill the header and the first body row, moving with Tab.
	for (const text of ["Weapon", "Damage", "Speed", "Sword", "12", "Fast"]) {
		await page.keyboard.type(text);
		await page.keyboard.press("Tab");
	}

	// Add a row below the sword row, then delete that new row. The commands act
	// on the row holding the caret, so the caret moves into the new row first.
	await table.locator("td", { hasText: "Sword" }).click();
	await toolbar(page).getByRole("button", { name: "Row below" }).click();
	await expect(table.locator("tr")).toHaveCount(4);
	await table.locator("tr").nth(2).locator("td").first().click();
	await toolbar(page).getByRole("button", { name: "Delete row" }).click();
	await expect(table.locator("tr")).toHaveCount(3);
	await expect(table.locator("td", { hasText: "Sword" })).toBeVisible();

	// Add a column to the right of Speed, then delete that new column.
	await table.locator("th", { hasText: "Speed" }).click();
	await toolbar(page).getByRole("button", { name: "Column right" }).click();
	await expect(table.locator("th")).toHaveCount(4);
	await table.locator("th").nth(3).click();
	await toolbar(page).getByRole("button", { name: "Delete column" }).click();
	await expect(table.locator("th")).toHaveText(["Weapon", "Damage", "Speed"]);

	// No merge is offered anywhere in the table controls.
	await expect(toolbar(page).getByRole("button", { name: /merge|split/i })).toHaveCount(0);

	// Right-align the damage column.
	await table.locator("td", { hasText: "12" }).click();
	await toolbar(page).getByRole("button", { name: "Right", exact: true }).click();
	await expect(toolbar(page).getByRole("button", { name: "Right", exact: true })).toHaveAttribute("aria-pressed", "true");
	await expect(table.locator("td", { hasText: "12" })).toHaveCSS("text-align", "right");

	// Drop an image file onto the intro paragraph.
	const intro = editor(page).locator("p", { hasText: "Weapon stats:" });
	const box = (await intro.boundingBox())!;
	const dataTransfer = await page.evaluateHandle((base64) => {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		const transfer = new DataTransfer();
		transfer.items.add(new File([bytes], "sword.png", { type: "image/png" }));
		return transfer;
	}, PNG_BASE64);
	await intro.dispatchEvent("drop", {
		dataTransfer,
		clientX: box.x + box.width - 2,
		clientY: box.y + box.height / 2,
	});

	const image = editor(page).locator(".markflow-image img");
	await expect(image).toHaveCount(1);
	await expect(page.getByRole("status")).toContainText("Image saved to /workspace/docs/assets/image-");
	await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);

	// Save and inspect what reached disk.
	await page.keyboard.press("Control+S");
	await expect(page.getByRole("tab", { name: /balance\.md/ })).not.toContainText("●");

	const saved = (await page.evaluate(() => window.__markflowReadWorkspaceFile?.("docs/balance.md"))) ?? "";
	const reference = /!\[sword\]\((assets\/image-\d{8}-\d{6}\.png)\)/.exec(saved)?.[1];
	expect(reference, saved).toBeDefined();
	expect(saved).not.toContain("data:");
	expect(saved).toContain("| Weapon | Damage | Speed |");
	expect(saved).toContain("| ------ | -----: | ----- |");
	expect(saved).toContain("| Sword  |     12 | Fast  |");
	expect(await page.evaluate((path) => window.__markflowHasWorkspaceFile?.(path), `docs/${reference}`)).toBe(true);

	// Reopen: close the tab and open the file again from disk.
	await page.getByRole("button", { name: "Close balance.md" }).click();
	await expect(page.getByRole("tab")).toHaveCount(0);
	await treeItem(page, "balance.md").dblclick();

	const reader = page.locator(".markflow-reader");
	await expect(reader.locator("th")).toHaveText(["Weapon", "Damage", "Speed"]);
	await expect(reader.locator("td", { hasText: "12" })).toHaveCSS("text-align", "right");
	await expect.poll(() => reader.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);

	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");
	await expect(editor(page).locator("th")).toHaveText(["Weapon", "Damage", "Speed"]);
	await expect(editor(page).locator(".markflow-image img")).toHaveCount(1);
});

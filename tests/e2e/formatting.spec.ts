import { expect, test, type Page } from "@playwright/test";

// Same dev bypass as tests/e2e/editor.spec.ts: the fixture hatch loads a
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

/**
 * Selects the first occurrence of `text` in the editor the way a user's drag
 * would: as a DOM selection, which ProseMirror picks up from the browser's
 * selectionchange event. Driving it with rapid Shift+Arrow presses right after
 * a click races ProseMirror's own mouse-selection handling, which no human
 * could type fast enough to trigger.
 */
async function selectText(page: Page, text: string) {
	await page.evaluate((target) => {
		const root = document.querySelector(".markflow-editor.ProseMirror");
		const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);

		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const index = node.textContent?.indexOf(target) ?? -1;
			if (index >= 0) {
				const range = document.createRange();
				range.setStart(node, index);
				range.setEnd(node, index + target.length);
				window.getSelection()?.removeAllRanges();
				window.getSelection()?.addRange(range);
				return;
			}
		}

		throw new Error(`Text not found in editor: ${target}`);
	}, text);

	await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe(text);
	// selectionchange is dispatched as a separate task after the change.
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

async function saveAndRead(page: Page): Promise<string> {
	await page.keyboard.press("Control+S");
	await expect(page.locator("header")).not.toContainText("●");

	return (await page.evaluate(() => window.__markflowReadFixtureFile?.())) ?? "";
}

test("typing Markdown syntax produces formatting without showing the syntax", async ({ page }) => {
	const editor = await openInEditor(page, "Start.\n");

	await editor.locator("p", { hasText: "Start." }).click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("## Section");
	await page.keyboard.press("Enter");
	await page.keyboard.type("Some **bold** and *italic* text.");
	await page.keyboard.press("Enter");
	await page.keyboard.type("- first");
	await page.keyboard.press("Enter");
	await page.keyboard.type("second");

	await expect(editor.locator("h2")).toHaveText("Section");
	await expect(editor.locator("strong")).toHaveText("bold");
	await expect(editor.locator("em")).toHaveText("italic");
	await expect(editor.locator("ul > li")).toHaveCount(2);
	await expect(editor).not.toContainText("**");
	await expect(editor).not.toContainText("##");

	expect(await saveAndRead(page)).toBe(
		"Start.\n\n## Section\n\nSome **bold** and *italic* text.\n\n- first\n- second\n",
	);
});

test("one undo after a conversion restores the literal syntax", async ({ page }) => {
	const editor = await openInEditor(page, "Start.\n");

	await editor.locator("p", { hasText: "Start." }).click();
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await page.keyboard.type("# ");
	await expect(editor.locator("h1")).toHaveCount(1);

	await page.keyboard.press("Control+z");

	await expect(editor.locator("h1")).toHaveCount(0);
	await expect(editor).toContainText("# ");
});

test("mark shortcuts apply formatting to a selection and to text typed next", async ({ page }) => {
	const editor = await openInEditor(page, "Make this bold.\n");

	await editor.locator("p").click();
	await selectText(page, "bold");
	await page.keyboard.press("Control+b");
	await expect(editor.locator("strong")).toHaveText("bold");

	// With nothing selected, the shortcut marks what is typed next.
	await page.keyboard.press("End");
	await page.keyboard.press("Control+i");
	await page.keyboard.type(" Yes");

	await expect(editor.locator("em")).toHaveText("Yes");
	expect(await saveAndRead(page)).toBe("Make this **bold**. *Yes*\n");
});

test("the link affordance creates a link from the selection", async ({ page }) => {
	const editor = await openInEditor(page, "Read the docs today.\n");

	await editor.locator("p").click();
	await selectText(page, "the docs");

	await page.keyboard.press("Control+k");
	const target = page.getByLabel("Link target");
	await expect(target).toBeFocused();
	await target.fill("https://example.com/docs");
	await page.keyboard.press("Enter");

	await expect(editor.locator("a")).toHaveText("the docs");
	expect(await saveAndRead(page)).toBe("Read [the docs](https://example.com/docs) today.\n");
});

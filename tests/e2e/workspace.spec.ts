import { expect, test, type Page } from "@playwright/test";

// Same dev bypass as the other suites: the folder dialog, the Rust scan and
// the Rust watcher only exist inside the Tauri webview. The hatch in
// `src/store/devFixtureHatch.ts` opens an in-memory workspace instead, and
// simulates external changes through the same batch handler the watcher
// feeds, so the tree, quick open, preview, tabs and conflict handling all run
// their real code.
const FILES = {
	"README.md": "# Readme\n\nIntro.\n",
	"design/combat.md": "# Combat\n\nParry window.\n",
	"design/enemies/boss.md": "# Boss\n\nPhase one.\n",
	"art/cover.png": "not really a png",
};

async function loadWorkspace(page: Page): Promise<void> {
	await page.goto("/");
	await page.evaluate((files) => window.__markflowLoadWorkspace?.(files), FILES);
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(name.replace(".", "\\.")) });
const treeItem = (page: Page, name: string) => page.getByRole("treeitem", { name, exact: true });

test("open a workspace, navigate the tree, quick open a file, edit it, switch tabs and return", async ({ page }) => {
	await loadWorkspace(page);

	// The tree lists top-level entries, folders collapsed.
	await expect(treeItem(page, "design")).toBeVisible();
	await expect(treeItem(page, "README.md")).toBeVisible();
	await expect(treeItem(page, "combat.md")).toHaveCount(0);

	// Non-Markdown files are listed, but inert.
	await treeItem(page, "art").click();
	await expect(treeItem(page, "cover.png")).toHaveAttribute("aria-disabled", "true");

	// Selecting a file previews it without opening a tab.
	await treeItem(page, "design").click();
	await treeItem(page, "combat.md").click();
	await expect(page.locator(".markflow-preview h1")).toHaveText("Combat");
	await expect(page.getByRole("tab")).toHaveCount(0);

	// Activating it opens it.
	await treeItem(page, "combat.md").dblclick();
	await expect(tab(page, "combat.md")).toHaveAttribute("aria-selected", "true");
	await expect(page.locator(".markflow-reader h1")).toHaveText("Combat");

	// Quick open finds a file from a non-contiguous fragment.
	await page.keyboard.press("Control+P");
	const quickOpen = page.getByRole("dialog", { name: "Quick open" });
	await expect(quickOpen).toBeVisible();
	await page.keyboard.type("enbss");
	await expect(quickOpen.getByRole("option").first()).toContainText("design/enemies/boss.md");
	await page.keyboard.press("Enter");
	await expect(quickOpen).toHaveCount(0);
	await expect(page.getByRole("tab")).toHaveCount(2);
	await expect(tab(page, "boss.md")).toHaveAttribute("aria-selected", "true");

	// Edit it in the editor.
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");
	const bossEditor = page.locator(".markflow-editor.ProseMirror").filter({ hasText: "Phase one." });
	await expect(bossEditor).toBeVisible();
	await bossEditor.locator("p", { hasText: "Phase one." }).click();
	await page.keyboard.press("End");
	// Keeps the load's hydration out of the edit's undo group (500 ms).
	await page.waitForTimeout(600);
	await page.keyboard.type(" extra");
	await expect(bossEditor).toContainText("Phase one. extra");

	// Only the edited document is marked dirty.
	await expect(tab(page, "boss.md")).toContainText("●");
	await expect(tab(page, "combat.md")).not.toContainText("●");

	// Switch away and back.
	await tab(page, "combat.md").click();
	await expect(page.locator(".markflow-reader h1")).toHaveText("Combat");
	await expect(bossEditor).toBeHidden();
	await tab(page, "boss.md").click();
	await expect(bossEditor).toBeVisible();

	// The caret is where it was left: typing continues the edit.
	await page.waitForTimeout(600);
	await page.keyboard.type("!");
	await expect(bossEditor.locator("p").last()).toHaveText("Phase one. extra!");

	// The undo history survived the switch.
	await page.keyboard.press("Control+Z");
	await expect(bossEditor.locator("p").last()).toHaveText("Phase one. extra");
	await page.keyboard.press("Control+Z");
	await expect(bossEditor.locator("p").last()).toHaveText("Phase one.");

	// Redo and let autosave write it.
	await page.keyboard.press("Control+Shift+Z");
	await expect(bossEditor.locator("p").last()).toHaveText("Phase one. extra");
	await expect
		.poll(() => page.evaluate(() => window.__markflowReadWorkspaceFile?.("design/enemies/boss.md")), { timeout: 5000 })
		.toContain("Phase one. extra");
	await expect(tab(page, "boss.md")).not.toContainText("●");
});

test("a clean document reloads silently when changed on disk", async ({ page }) => {
	await loadWorkspace(page);
	await treeItem(page, "README.md").dblclick();
	await expect(page.locator(".markflow-reader p")).toHaveText("Intro.");

	await page.evaluate(() => window.__markflowChangeExternally?.("README.md", "# Readme\n\nRewritten by git.\n"));

	await expect(page.locator(".markflow-reader p")).toHaveText("Rewritten by git.");
	await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a dirty document prompts when changed on disk, and nothing is lost until the user chooses", async ({ page }) => {
	await loadWorkspace(page);
	await treeItem(page, "README.md").dblclick();
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");
	const editor = page.locator(".markflow-editor.ProseMirror").filter({ hasText: "Intro." });
	await editor.locator("p", { hasText: "Intro." }).click();
	await page.keyboard.press("End");
	await page.keyboard.type(" Local edit.");

	await page.evaluate(() => window.__markflowChangeExternally?.("README.md", "# Readme\n\nTheir edit.\n"));

	const alert = page.getByRole("alert");
	await expect(alert).toContainText("changed on disk");

	// Past the autosave delay, neither side has been touched.
	await page.waitForTimeout(2500);
	await expect(editor).toContainText("Intro. Local edit.");
	expect(await page.evaluate(() => window.__markflowReadWorkspaceFile?.("README.md"))).toContain("Their edit.");

	await alert.getByRole("button", { name: "Reload from disk" }).click();
	await expect(alert).toHaveCount(0);
	await expect(page.locator(".markflow-editor.ProseMirror").filter({ hasText: "Their edit." })).toBeVisible();
	await expect(tab(page, "README.md")).not.toContainText("●");
});

test("a document deleted on disk stays open and can be saved again", async ({ page }) => {
	await loadWorkspace(page);
	await treeItem(page, "README.md").dblclick();

	await page.evaluate(() => window.__markflowChangeExternally?.("README.md", null));

	const alert = page.getByRole("alert");
	await expect(alert).toContainText("was deleted on disk");
	await expect(treeItem(page, "README.md")).toHaveCount(0);
	await expect(page.locator(".markflow-reader p")).toHaveText("Intro.");

	await alert.getByRole("button", { name: "Save it again" }).click();
	await expect(alert).toHaveCount(0);
	await expect
		.poll(() => page.evaluate(() => window.__markflowReadWorkspaceFile?.("README.md")))
		.toBe("# Readme\n\nIntro.\n");
});

test("closing a tab with unsaved changes asks first", async ({ page }) => {
	await loadWorkspace(page);
	await treeItem(page, "README.md").dblclick();
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");
	await page.locator(".markflow-editor.ProseMirror p", { hasText: "Intro." }).click();
	await page.keyboard.type("x");
	await expect(tab(page, "README.md")).toContainText("●");

	page.once("dialog", (dialog) => void dialog.dismiss());
	await page.getByRole("button", { name: "Close README.md" }).click();
	await expect(tab(page, "README.md")).toBeVisible();

	page.once("dialog", (dialog) => void dialog.accept());
	await page.getByRole("button", { name: "Close README.md" }).click();
	await expect(page.getByRole("tab")).toHaveCount(0);
});

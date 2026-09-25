import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Same dev bypass as tests/e2e/reader.spec.ts: the file dialog and real disk
// access only exist inside the Tauri webview, which this suite does not
// drive. `installDevFixtureHatch` also installs the editor's in-memory
// filesystem hatch (src/editor/fs.ts) under the same path, so save goes
// through the real load/save code path end to end, just against memory
// instead of the OS.
const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"..",
	"src",
	"core",
	"fixtures",
	"edge",
	"headings-and-paragraphs.md",
);
const fixtureSource = readFileSync(fixturePath, "utf8");

test("opens a document in the editor, edits it, saves, and the edit persists", async ({ page }) => {
	await page.goto("/");

	await page.evaluate((source) => {
		window.__markflowLoadFixture?.(source);
	}, fixtureSource);

	// reader -> raw -> editor
	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");

	const editor = page.locator(".markflow-editor.ProseMirror");
	await expect(editor).toBeVisible();
	await expect(editor).not.toContainText("#");

	const targetParagraph = editor.locator("p", { hasText: "Body under a section." });
	await targetParagraph.click();
	await page.keyboard.press("End");
	await page.keyboard.type(" Edited via the editor.");

	await expect(page.locator("header")).toContainText("●");

	await page.keyboard.press("Control+S");

	await expect(page.locator("header")).not.toContainText("●");

	const savedText = await page.evaluate(() => window.__markflowReadFixtureFile?.());
	expect(savedText).toContain("Body under a section. Edited via the editor.");
	expect(savedText).toContain("# Title");
	expect(savedText).toContain("## Another");
	expect(savedText).toContain("More body.");
});

test("undo reverses an edit made in the editor", async ({ page }) => {
	await page.goto("/");

	await page.evaluate((source) => {
		window.__markflowLoadFixture?.(source);
	}, fixtureSource);

	await page.keyboard.press("Control+E");
	await page.keyboard.press("Control+E");

	const editor = page.locator(".markflow-editor.ProseMirror");
	const targetParagraph = editor.locator("p", { hasText: "More body." });
	await expect(targetParagraph).toBeVisible();
	await targetParagraph.click();
	await page.keyboard.press("End");

	// UndoRedo groups transactions within 500ms into one undo step (its
	// `newGroupDelay`). Waiting past that keeps the load's hydration and this
	// edit in separate groups, so a single undo below reverses only the edit.
	await page.waitForTimeout(600);
	await page.keyboard.type(" extra");
	await expect(editor).toContainText("More body. extra");

	await page.keyboard.press("Control+z");
	await expect(editor).not.toContainText("More body. extra");
	await expect(editor).toContainText("More body.");
});

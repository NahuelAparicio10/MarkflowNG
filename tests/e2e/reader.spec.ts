import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// The Tauri dialog/fs plugins only exist inside the real Tauri webview, which
// this suite does not drive (`playwright.config.ts` starts the plain Vite dev
// server). A document is loaded through the dev-only hatch in
// `src/store/devFixtureHatch.ts` instead, so the reader, raw view and outline
// are exercised exactly as they run in the app.
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

test("opens a document, shows it formatted, toggles raw view, and navigates via the outline", async ({ page }) => {
	await page.goto("/");

	await page.evaluate((source) => {
		window.__markflowLoadFixture?.(source);
	}, fixtureSource);

	const reader = page.locator(".markflow-reader");
	await expect(reader.locator("h1, h2, h3").first()).toBeVisible();
	await expect(reader).not.toContainText("#");

	await page.getByRole("button", { name: "Outline" }).click();
	const firstOutlineEntry = page.locator(".markflow-outline button").first();
	await expect(firstOutlineEntry).toBeVisible();
	await firstOutlineEntry.click();

	await page.keyboard.press("Control+E");
	await expect(page.locator(".markflow-raw-content")).toBeVisible();
	await expect(page.locator(".markflow-reader")).toHaveCount(0);

	await page.keyboard.press("Control+E");
	await expect(page.locator(".markflow-reader")).toBeVisible();
});

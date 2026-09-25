import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("document navigation controls", () => {
	it("exposes icon-led mode and left document-navigation controls", () => {
		const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
		const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
		expect(app).toContain("markflow-mode-switch");
		expect(app).toContain('aria-label="Edit document"');
		expect(app).toContain('aria-controls="markflow-document-navigation-content"');
		expect(app).toContain('"Hide document navigation" : "Show document navigation"');
		expect(styles).toContain(".markflow-document-nav.is-collapsed");
	});
});

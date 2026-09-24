import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { useAppearanceStore as AppearanceStore } from "./appearance";

describe("appearance preferences", () => {
	const values = new Map<string, string>();
	let useAppearanceStore: typeof AppearanceStore;

	beforeEach(async () => {
		values.clear();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => { values.set(key, value); },
			removeItem: (key: string) => { values.delete(key); },
		});
		vi.resetModules();
		({ useAppearanceStore } = await import("./appearance"));
		useAppearanceStore.setState({ theme: "dark" });
	});

	afterEach(() => vi.unstubAllGlobals());

	it("defaults to dark and persists a theme selection on device", () => {
		expect(useAppearanceStore.getState().theme).toBe("dark");
		useAppearanceStore.getState().setTheme("sepia");
		expect(useAppearanceStore.getState().theme).toBe("sepia");
		const saved = JSON.parse(values.get("markflow-appearance")!);
		expect(saved.state.theme).toBe("sepia");
	});

	it("offers accessible Dark, Light, and Sepia choices", async () => {
		const { default: ThemeSelector } = await import("../ui/ThemeSelector");
		const html = renderToStaticMarkup(createElement(ThemeSelector));
		expect(html).toContain('aria-label="Color theme"');
		expect(html).toContain('<option value="dark"');
		expect(html).toContain('<option value="light"');
		expect(html).toContain('<option value="sepia"');
	});
});

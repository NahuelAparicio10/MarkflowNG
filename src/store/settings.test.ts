import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("document outline preference", () => {
	const values = new Map<string, string>();
	let useSettingsStore: typeof import("./settings").useSettingsStore;

	beforeEach(async () => {
		values.clear();
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => { values.set(key, value); },
			removeItem: (key: string) => { values.delete(key); },
		});
		vi.resetModules();
		({ useSettingsStore } = await import("./settings"));
	});

	afterEach(() => vi.unstubAllGlobals());

	it("starts open and persists when the user collapses it", () => {
		expect(useSettingsStore.getState().outlineOpen).toBe(true);
		useSettingsStore.getState().setOutlineOpen(false);
		expect(useSettingsStore.getState().outlineOpen).toBe(false);
		expect(JSON.parse(values.get("markflow-settings")!).state.outlineOpen).toBe(false);
	});
});

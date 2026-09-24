import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createOpenCodeProvider, discoverOpenCode, testOpenCode } from "./opencode";
import { DEVICE_PROVIDER_SCOPE, useAiSettings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
	vi.resetAllMocks();
	useAiSettings.setState({ providers: new Map(), deviceConfiguration: null, legacyConfigurations: {}, migrationResolved: false, migrationError: null });
});

describe("OpenCode provider boundary", () => {
	it("discovers models through the narrow status command", async () => {
		vi.mocked(invoke).mockResolvedValue({ version: "2.0.15", models: [] });
		await discoverOpenCode("C:/notes");
		expect(invoke).toHaveBeenCalledWith("opencode_status", { directory: "C:/notes" });
	});

	it("tests with synthetic backend content only", async () => {
		vi.mocked(invoke).mockResolvedValue(undefined);
		await testOpenCode("openai/model", null);
		expect(invoke).toHaveBeenCalledWith("test_opencode", { directory: null, model: "openai/model", requestId: expect.any(String) });
	});

	it("sends generation text without credentials or API paths", async () => {
		vi.mocked(invoke).mockResolvedValue("Result");
		const result = await createOpenCodeProvider("openai/model").generate({ instruction: "Rewrite", content: "Selection" });
		expect(result).toEqual({ ok: true, text: "Result" });
		expect(invoke).toHaveBeenCalledWith("generate_opencode", {
			directory: null, requestId: expect.any(String), model: "openai/model", instruction: "Rewrite", content: "Selection",
		});
	});

	it("cancels the exact in-flight OpenCode request", async () => {
		const controller = new AbortController();
		vi.mocked(invoke).mockImplementation((command) => command === "generate_opencode"
			? new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject({ code: "unavailable" })))
			: Promise.resolve());
		const generation = createOpenCodeProvider("openai/model").generate({ instruction: "Rewrite", content: "Selection", signal: controller.signal });
		controller.abort();
		expect(await generation).toMatchObject({ ok: false, error: { code: "cancelled" } });
		expect(invoke).toHaveBeenCalledWith("cancel_opencode", { requestId: expect.any(String) });
	});

	it("requires consent for a remote OpenCode model", async () => {
		await expect(useAiSettings.getState().configureOpenCode("openai/model", false, false)).rejects.toThrow();
		expect(invoke).not.toHaveBeenCalled();
	});

	it("persists only model provenance and restores without touching a credential", async () => {
		await useAiSettings.getState().configureOpenCode("openai/model", false, true);
		expect(useAiSettings.getState().deviceConfiguration).toEqual({
			kind: "opencode", model: "openai/model", local: false, remoteConsent: true,
		});
		expect(useAiSettings.getState().providers.get(DEVICE_PROVIDER_SCOPE)?.kind).toBe("opencode");
		expect(invoke).not.toHaveBeenCalled();

		useAiSettings.setState({ providers: new Map() });
		await useAiSettings.getState().restore();
		expect(useAiSettings.getState().providers.get(DEVICE_PROVIDER_SCOPE)?.kind).toBe("opencode");
		expect(invoke).not.toHaveBeenCalled();
	});
});

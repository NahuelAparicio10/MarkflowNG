import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createRemoteProvider } from "./remote";
import { useAiSettings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
	vi.resetAllMocks();
	useAiSettings.setState({ providers: new Map(), configurations: {} });
});

describe("remote provider boundary", () => {
	it("starts unconfigured without making requests", () => {
		expect(useAiSettings.getState().providers.size).toBe(0);
		expect(invoke).not.toHaveBeenCalled();
	});

	it("requires consent before even crossing the backend bridge", async () => {
		await expect(useAiSettings.getState().configureRemote("workspace", {
			endpoint: "https://example.com/v1/chat/completions", model: "test", remoteConsent: false,
		}, "secret")).rejects.toThrow();
		expect(invoke).not.toHaveBeenCalled();
	});

	it("sends only explicit request content and the workspace identifier", async () => {
		vi.mocked(invoke).mockResolvedValue("# Result");
		expect(await createRemoteProvider("workspace").generate({ instruction: "Rewrite", content: "Selection" }))
			.toEqual({ ok: true, text: "# Result" });
		expect(invoke).toHaveBeenCalledWith("generate_ai", { workspace: "workspace", instruction: "Rewrite", content: "Selection" });
	});

	it("never echoes or logs credential-bearing transport failures", async () => {
		const log = vi.spyOn(console, "error");
		vi.mocked(invoke).mockRejectedValue({ code: "invalid-credential", message: "Authorization: Bearer secret" });
		const result = await createRemoteProvider("workspace").generate({ instruction: "Rewrite", content: "Selection" });
		expect(JSON.stringify(result)).not.toContain("secret");
		expect(result.ok).toBe(false);
		expect(log).not.toHaveBeenCalled();
		log.mockRestore();
	});

	it("does not dispatch pre-cancelled requests", async () => {
		const controller = new AbortController();
		controller.abort();
		expect(await createRemoteProvider("workspace").generate({ instruction: "Rewrite", content: "Selection", signal: controller.signal }))
			.toMatchObject({ ok: false, error: { code: "cancelled" } });
		expect(invoke).not.toHaveBeenCalled();
	});

	it("does not keep credentials in application settings", async () => {
		vi.mocked(invoke).mockResolvedValue(undefined);
		await useAiSettings.getState().configureRemote("workspace", {
			endpoint: "https://example.com/v1/chat/completions", model: "test", remoteConsent: true,
		}, "secret");
		expect(useAiSettings.getState().providers.get("workspace")?.kind).toBe("remote");
		expect(useAiSettings.getState().providers.has("other-workspace")).toBe(false);
		expect(JSON.stringify(useAiSettings.getState())).not.toContain("secret");
	});
});

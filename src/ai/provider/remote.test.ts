import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { createRemoteProvider } from "./remote";
import { DEVICE_PROVIDER_SCOPE, migratePersistedAiSettings, useAiSettings } from "./settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
	vi.resetAllMocks();
	useAiSettings.setState({ providers: new Map(), deviceConfiguration: null, legacyConfigurations: {}, migrationResolved: false, migrationError: null });
});

describe("remote provider boundary", () => {
	it("starts unconfigured without making requests", () => {
		expect(useAiSettings.getState().providers.size).toBe(0);
		expect(invoke).not.toHaveBeenCalled();
	});

	it("requires consent before even crossing the backend bridge", async () => {
		await expect(useAiSettings.getState().configureRemote({
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
		await useAiSettings.getState().configureRemote({
			endpoint: "https://example.com/v1/chat/completions", model: "test", remoteConsent: true,
		}, "secret");
		expect(useAiSettings.getState().providers.get(DEVICE_PROVIDER_SCOPE)?.kind).toBe("remote");
		expect(useAiSettings.getState().providers.size).toBe(1);
		expect(invoke).toHaveBeenCalledWith("configure_ai", expect.objectContaining({ workspace: DEVICE_PROVIDER_SCOPE }));
		expect(JSON.stringify(useAiSettings.getState())).not.toContain("secret");
	});

	it("preserves legacy workspace configurations as migration choices", () => {
		const legacy = { "C:/one": { endpoint: "https://one.test", model: "one", remoteConsent: true, kind: "remote" as const } };
		expect(migratePersistedAiSettings({ configurations: legacy })).toEqual({
			deviceConfiguration: null, legacyConfigurations: legacy, migrationResolved: false,
		});
		expect(migratePersistedAiSettings({ configurations: {} })).toMatchObject({ legacyConfigurations: {}, migrationResolved: false });
	});

	it("copies a legacy credential through the backend before enabling device scope", async () => {
		vi.mocked(invoke).mockResolvedValue(undefined);
		const config = { endpoint: "https://one.test/v1/chat/completions", model: "model", remoteConsent: true, kind: "remote" as const };
		useAiSettings.setState({ legacyConfigurations: { "C:/one": config } });
		await useAiSettings.getState().migrateLegacy("C:/one");
		expect(invoke).toHaveBeenNthCalledWith(1, "migrate_ai_credential", expect.objectContaining({
			fromWorkspace: "C:/one", toWorkspace: DEVICE_PROVIDER_SCOPE,
		}));
		expect(invoke).toHaveBeenNthCalledWith(2, "configure_ai", expect.objectContaining({ workspace: DEVICE_PROVIDER_SCOPE }));
		expect(useAiSettings.getState().migrationResolved).toBe(true);
		expect(useAiSettings.getState().deviceConfiguration).toEqual(config);
	});

	it("automatically migrates a single saved provider while retaining its legacy entry", async () => {
		vi.mocked(invoke).mockResolvedValue(undefined);
		const config = { endpoint: "https://one.test/v1/chat/completions", model: "one", remoteConsent: true, kind: "remote" as const };
		useAiSettings.setState({ legacyConfigurations: { "C:/one": config } });
		await useAiSettings.getState().restore();
		expect(invoke).toHaveBeenNthCalledWith(1, "migrate_ai_credential", expect.any(Object));
		expect(useAiSettings.getState().deviceConfiguration).toEqual(config);
		expect(useAiSettings.getState().legacyConfigurations["C:/one"]).toEqual(config);
	});

	it("does not silently select between multiple saved providers", async () => {
		useAiSettings.setState({ legacyConfigurations: {
			"C:/one": { endpoint: "https://one.test", model: "one", remoteConsent: true, kind: "remote" },
			"C:/two": { endpoint: "http://127.0.0.1:8080", model: "two", remoteConsent: false, kind: "local" },
		} });
		await useAiSettings.getState().restore();
		expect(invoke).not.toHaveBeenCalled();
		expect(useAiSettings.getState().deviceConfiguration).toBeNull();
	});

	it("migrates local settings without invoking credential migration", async () => {
		vi.mocked(invoke).mockResolvedValue(undefined);
		const config = { endpoint: "http://127.0.0.1:8080/v1/chat/completions", model: "local", remoteConsent: false, kind: "local" as const };
		useAiSettings.setState({ legacyConfigurations: { "C:/one": config } });
		await useAiSettings.getState().restore();
		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith("configure_ai", expect.objectContaining({ workspace: DEVICE_PROVIDER_SCOPE }));
		expect(useAiSettings.getState().providers.get(DEVICE_PROVIDER_SCOPE)?.kind).toBe("local");
	});
});

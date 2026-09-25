import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createRemoteProvider } from "./remote";
import { createLocalProvider } from "./local";
import type { AiProvider } from "./types";
import { createOpenCodeProvider } from "./opencode";

export const DEVICE_PROVIDER_SCOPE = "__markflow_device__";

export interface RemoteConfig {
	endpoint: string;
	model: string;
	remoteConsent: boolean;
}

export interface DirectProviderConfig extends RemoteConfig {
	kind: "remote" | "local";
}

export interface OpenCodeProviderConfig {
	kind: "opencode";
	model: string;
	local: boolean;
	remoteConsent: boolean;
}

export type SavedProviderConfig = DirectProviderConfig | OpenCodeProviderConfig;

interface PersistedAiSettings {
	deviceConfiguration: SavedProviderConfig | null;
	legacyConfigurations: Readonly<Record<string, SavedProviderConfig>>;
	migrationResolved: boolean;
}

interface AiSettingsState extends PersistedAiSettings {
	/** Runtime provider instances; credentials never enter this store. */
	providers: ReadonlyMap<string, AiProvider>;
	migrationError: string | null;
	restore(): Promise<void>;
	migrateLegacy(workspace: string): Promise<void>;
	configureRemote(config: RemoteConfig, secret: string): Promise<void>;
	configureOpenCode(model: string, local: boolean, remoteConsent: boolean): Promise<void>;
	disable(): Promise<void>;
	configureLocal(endpoint: string, model: string): Promise<void>;
}

type LegacyPersistedState = {
	configurations?: Record<string, SavedProviderConfig>;
	deviceConfiguration?: SavedProviderConfig | null;
	legacyConfigurations?: Record<string, SavedProviderConfig>;
	migrationResolved?: boolean;
};

/** Pure migration keeps legacy workspace settings available for explicit selection. */
export function migratePersistedAiSettings(persisted: unknown): PersistedAiSettings {
	const previous = persisted && typeof persisted === "object" ? persisted as LegacyPersistedState : {};
	const legacyConfigurations = previous.legacyConfigurations ?? previous.configurations ?? {};
	return {
		deviceConfiguration: previous.deviceConfiguration ?? null,
		legacyConfigurations,
		migrationResolved: previous.migrationResolved ?? false,
	};
}

function tauriConfig(config: DirectProviderConfig) {
	return { endpoint: config.endpoint, model: config.model, local: config.kind === "local", remoteConsent: config.remoteConsent };
}

function providerFor(config: SavedProviderConfig): AiProvider {
	if (config.kind === "opencode") return createOpenCodeProvider(config.model);
	return config.kind === "local" ? createLocalProvider(DEVICE_PROVIDER_SCOPE) : createRemoteProvider(DEVICE_PROVIDER_SCOPE);
}

export const useAiSettings = create<AiSettingsState>()(persist((set, get) => ({
	providers: new Map(),
	deviceConfiguration: null,
	legacyConfigurations: {},
	migrationResolved: false,
	migrationError: null,
	async restore() {
		const state = get();
		if (state.deviceConfiguration) {
			try {
				if (state.deviceConfiguration.kind !== "opencode") {
					await invoke("configure_ai", { workspace: DEVICE_PROVIDER_SCOPE, config: tauriConfig(state.deviceConfiguration), secret: null });
				}
				set((current) => ({ providers: new Map(current.providers).set(DEVICE_PROVIDER_SCOPE, providerFor(state.deviceConfiguration!)) }));
			} catch {
				set({ migrationError: "The saved AI provider could not be restored. Review provider settings." });
			}
			return;
		}
		if (state.migrationResolved) return;
		const legacy = Object.keys(state.legacyConfigurations);
		if (legacy.length === 1) {
			try {
				await get().migrateLegacy(legacy[0]);
			} catch {
				set({ migrationError: "The saved AI provider could not be migrated. Choose it to retry or configure a provider again." });
			}
		}
	},
	async migrateLegacy(workspace) {
		const config = get().legacyConfigurations[workspace];
		if (!config) throw new Error("Legacy provider configuration not found.");
		if (config.kind === "opencode") throw new Error("Invalid legacy provider configuration.");
		if (config.kind === "remote") {
			await invoke("migrate_ai_credential", { fromWorkspace: workspace, toWorkspace: DEVICE_PROVIDER_SCOPE, config: tauriConfig(config) });
		}
		await invoke("configure_ai", { workspace: DEVICE_PROVIDER_SCOPE, config: tauriConfig(config), secret: null });
		set((state) => ({
			deviceConfiguration: config,
			migrationResolved: true,
			migrationError: null,
			providers: new Map(state.providers).set(DEVICE_PROVIDER_SCOPE, providerFor(config)),
		}));
	},
	async configureLocal(endpoint, model) {
		const config: SavedProviderConfig = { endpoint, model, remoteConsent: false, kind: "local" };
		await invoke("configure_ai", { workspace: DEVICE_PROVIDER_SCOPE, config: tauriConfig(config), secret: null });
		set((state) => ({
			deviceConfiguration: config,
			migrationResolved: true,
			migrationError: null,
			providers: new Map(state.providers).set(DEVICE_PROVIDER_SCOPE, providerFor(config)),
		}));
	},
	async configureRemote(config, secret) {
		if (!config.remoteConsent) throw new Error("Confirm what will be sent before enabling a remote provider.");
		const saved: SavedProviderConfig = { ...config, kind: "remote" };
		await invoke("configure_ai", { workspace: DEVICE_PROVIDER_SCOPE, config: tauriConfig(saved), secret: secret || null });
		set((state) => ({
			deviceConfiguration: saved,
			migrationResolved: true,
			migrationError: null,
			providers: new Map(state.providers).set(DEVICE_PROVIDER_SCOPE, providerFor(saved)),
		}));
	},
	async configureOpenCode(model, local, remoteConsent) {
		if (!local && !remoteConsent) throw new Error("Confirm what will be sent before enabling a remote OpenCode model.");
		const config: OpenCodeProviderConfig = { kind: "opencode", model, local, remoteConsent: local ? false : remoteConsent };
		set((state) => ({
			deviceConfiguration: config,
			migrationResolved: true,
			migrationError: null,
			providers: new Map(state.providers).set(DEVICE_PROVIDER_SCOPE, providerFor(config)),
		}));
	},
	async disable() {
		await invoke("configure_ai", { workspace: DEVICE_PROVIDER_SCOPE, config: null, secret: null });
		set((state) => {
			const providers = new Map(state.providers);
			providers.delete(DEVICE_PROVIDER_SCOPE);
			return { providers, deviceConfiguration: null, migrationResolved: true, migrationError: null };
		});
	},
}), {
	name: "markflow-ai-provider-settings",
	version: 2,
	storage: createJSONStorage(() => localStorage),
	partialize: (state) => ({
		deviceConfiguration: state.deviceConfiguration,
		legacyConfigurations: state.legacyConfigurations,
		migrationResolved: state.migrationResolved,
	}),
	migrate: (persisted) => migratePersistedAiSettings(persisted),
}));

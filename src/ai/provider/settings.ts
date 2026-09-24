import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createRemoteProvider } from "./remote";
import { createLocalProvider } from "./local";
import type { AiProvider } from "./types";

export interface RemoteConfig {
	endpoint: string;
	model: string;
	remoteConsent: boolean;
}

interface AiSettingsState {
	/** Session-local, per workspace. Credentials never enter this store. */
	providers: ReadonlyMap<string, AiProvider>;
	configurations: Readonly<Record<string, RemoteConfig & { kind: "remote" | "local" }>>;
	restore(): Promise<void>;
	configureRemote(workspace: string, config: RemoteConfig, secret: string): Promise<void>;
	disable(workspace: string): Promise<void>;
	configureLocal(workspace: string, endpoint: string, model: string): Promise<void>;
}

export const useAiSettings = create<AiSettingsState>()(persist((set, get) => ({
	providers: new Map(),
	configurations: {},
	async restore() {
		for (const [workspace, config] of Object.entries(get().configurations)) {
			if (get().providers.has(workspace)) continue;
			try {
				await invoke("configure_ai", { workspace, config: { ...config, local: config.kind === "local" }, secret: null });
				set((state) => ({ providers: new Map(state.providers).set(workspace,
					config.kind === "local" ? createLocalProvider(workspace) : createRemoteProvider(workspace)) }));
			} catch {
				set((state) => {
					const configurations = { ...state.configurations };
					delete configurations[workspace];
					return { configurations };
				});
			}
		}
	},
	async configureLocal(workspace, endpoint, model) {
		await invoke("configure_ai", { workspace, config: { endpoint, model, local: true, remoteConsent: false }, secret: null });
		set((state) => ({ providers: new Map(state.providers).set(workspace, createLocalProvider(workspace)),
			configurations: { ...state.configurations, [workspace]: { endpoint, model, remoteConsent: false, kind: "local" } } }));
	},
	async configureRemote(workspace, config, secret) {
		if (!config.remoteConsent) throw new Error("Confirm what will be sent before enabling a remote provider.");
		await invoke("configure_ai", { workspace, config, secret: secret || null });
		set((state) => ({ providers: new Map(state.providers).set(workspace, createRemoteProvider(workspace)),
			configurations: { ...state.configurations, [workspace]: { ...config, kind: "remote" } } }));
	},
	async disable(workspace) {
		await invoke("configure_ai", { workspace, config: null, secret: null });
		set((state) => {
			const providers = new Map(state.providers);
			providers.delete(workspace);
			const configurations = { ...state.configurations };
			delete configurations[workspace];
			return { providers, configurations };
		});
	},
}), {
	name: "markflow-ai-provider-settings",
	storage: createJSONStorage(() => localStorage),
	partialize: (state) => ({ configurations: state.configurations }),
}));

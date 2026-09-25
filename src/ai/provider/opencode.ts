import { invoke } from "@tauri-apps/api/core";
import { providerFailure } from "./remote";
import type { AiProvider } from "./types";

export interface OpenCodeModel {
	id: string;
	providerId: string;
	name: string;
	local: boolean;
	mayCost: boolean;
}

export interface OpenCodeStatus {
	version: string;
	models: OpenCodeModel[];
}

export async function discoverOpenCode(directory?: string | null): Promise<OpenCodeStatus> {
	return invoke<OpenCodeStatus>("opencode_status", { directory: directory || null });
}

function makeRequestId(): string {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export async function testOpenCode(model: string, directory?: string | null, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) throw { code: "cancelled" };
	const requestId = makeRequestId();
	const cancel = () => { void invoke("cancel_opencode", { requestId }).catch(() => undefined); };
	signal?.addEventListener("abort", cancel, { once: true });
	try {
		await invoke("test_opencode", { directory: directory || null, model, requestId });
		if (signal?.aborted) throw { code: "cancelled" };
	} catch (error) {
		if (signal?.aborted) throw { code: "cancelled" };
		throw error;
	} finally {
		signal?.removeEventListener("abort", cancel);
	}
}

export function createOpenCodeProvider(model: string): AiProvider {
	return {
		kind: "opencode",
		async generate({ instruction, content, signal }) {
			if (signal?.aborted) return providerFailure({ code: "cancelled" });
			const requestId = makeRequestId();
			const cancel = () => { void invoke("cancel_opencode", { requestId }).catch(() => undefined); };
			signal?.addEventListener("abort", cancel, { once: true });
			try {
				const text = await invoke<string>("generate_opencode", {
					directory: null,
					requestId,
					model,
					instruction,
					content,
				});
				if (signal?.aborted) return providerFailure({ code: "cancelled" });
				return typeof text === "string" && text.trim()
					? { ok: true, text }
					: providerFailure({ code: "invalid-response" });
			} catch (error) {
				if (signal?.aborted) return providerFailure({ code: "cancelled" });
				return providerFailure(error);
			} finally {
				signal?.removeEventListener("abort", cancel);
			}
		},
	};
}

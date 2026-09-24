import { invoke } from "@tauri-apps/api/core";
import type { AiProvider, GenerationResult, ProviderErrorCode } from "./types";

const MESSAGES: Record<ProviderErrorCode, string> = {
	"not-configured": "Configure a provider for this workspace first.",
	"invalid-credential": "The provider credential is missing or invalid.",
	"unavailable": "The provider is unavailable. Check its settings and try again.",
	"rate-limited": "The provider is rate limited. Try again later.",
	"invalid-response": "The provider returned an invalid response.",
	"not-installed": "OpenCode V2 was not found. Install it, then connect an account with /connect.",
	"incompatible": "This OpenCode version is not compatible with Markflow. Update OpenCode V2.",
	"no-models": "OpenCode has no usable text models. Open OpenCode and run /connect, or connect a local model.",
	"invalid-model": "The selected OpenCode model is not available.",
	"cancelled": "Generation was cancelled.",
};

/** Never forward exception messages, which may contain headers, secrets or document text. */
export function providerFailure(error: unknown): GenerationResult {
	const candidate = error && typeof error === "object" && "code" in error ? error.code : null;
	const code = typeof candidate === "string" && Object.prototype.hasOwnProperty.call(MESSAGES, candidate)
		? candidate as ProviderErrorCode : "unavailable";
	return { ok: false, error: { code, message: MESSAGES[code] } };
}

export function createRemoteProvider(workspace: string): AiProvider {
	return {
		kind: "remote",
		async generate({ instruction, content, signal }) {
			if (signal?.aborted) return providerFailure({ code: "cancelled" });
			try {
				const text = await invoke<string>("generate_ai", { workspace, instruction, content });
				if (signal?.aborted) return providerFailure({ code: "cancelled" });
				return typeof text === "string" && text.trim()
					? { ok: true, text } : providerFailure({ code: "invalid-response" });
			} catch (error) {
				return providerFailure(error);
			}
		},
	};
}

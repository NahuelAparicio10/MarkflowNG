/** Only explicitly supplied content is sent to the configured provider. */
export interface GenerationRequest {
	instruction: string;
	content: string;
	signal?: AbortSignal;
}

export type ProviderErrorCode =
	| "not-configured"
	| "invalid-credential"
	| "unavailable"
	| "rate-limited"
	| "invalid-response"
	| "not-installed"
	| "incompatible"
	| "no-models"
	| "invalid-model"
	| "cancelled";

export interface ProviderFailure {
	code: ProviderErrorCode;
	/** Safe, application-authored text; never a raw transport error or response body. */
	message: string;
}

export type GenerationResult =
	| { ok: true; text: string }
	| { ok: false; error: ProviderFailure };

/** Vendor-specific protocols and credential access belong in implementations. */
export interface AiProvider {
	readonly kind: "remote" | "local" | "opencode";
	/** Expected provider failures resolve as structured errors rather than throwing. */
	generate(request: GenerationRequest): Promise<GenerationResult>;
}

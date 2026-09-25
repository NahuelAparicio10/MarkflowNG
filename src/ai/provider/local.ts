import { createRemoteProvider } from "./remote";
import type { AiProvider } from "./types";

/** llama.cpp's chat-completions protocol; Rust enforces literal loopback and disables proxies. */
export function createLocalProvider(workspace: string): AiProvider {
	return { ...createRemoteProvider(workspace), kind: "local" };
}

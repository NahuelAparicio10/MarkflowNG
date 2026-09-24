import { useState } from "react";
import { providerFailure } from "./provider/remote";
import { useAiSettings } from "./provider/settings";

export default function ProviderSettings({ onClose }: { workspace?: string; onClose(): void }) {
	const [endpoint, setEndpoint] = useState("");
	const [local, setLocal] = useState(false);
	const [model, setModel] = useState("");
	const [secret, setSecret] = useState("");
	const [consent, setConsent] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save(disable: boolean) {
		setPending(true);
		setError(null);
		try {
			const settings = useAiSettings.getState();
			if (disable) await settings.disable();
			else if (local) await settings.configureLocal(endpoint, model);
			else await settings.configureRemote({ endpoint, model, remoteConsent: consent }, secret);
			onClose();
		} catch (error) {
			const result = providerFailure(error);
			if (!result.ok) setError(result.error.message);
		} finally {
			setSecret("");
			setPending(false);
		}
	}

	return (
		<section role="dialog" aria-label="AI provider settings" className="border-b p-4">
			<h2>AI provider — this device</h2>
			<p>No provider is enabled by default. Provider and model settings are saved on this device; credentials remain in the operating system credential store.</p>
			<form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="flex flex-col gap-2">
				<label>Provider <select disabled={pending} value={local ? "local" : "remote"} onChange={(event) => {
					const local = event.target.value === "local";
					setLocal(local); setConsent(false); setEndpoint(local ? "http://127.0.0.1:8080/v1/chat/completions" : "");
				}}><option value="remote">Remote API</option><option value="local">Local llama.cpp server</option></select></label>
				{local ? <p>Start llama-server with your model. Only literal loopback addresses are accepted; no proxy is used.</p> : null}
				<label>Chat-completions endpoint <input type="url" required value={endpoint} disabled={pending}
					onChange={(event) => { setEndpoint(event.target.value); setConsent(false); }} /></label>
				<label>Model <input required value={model} disabled={pending} onChange={(event) => setModel(event.target.value)} /></label>
				{!local ? <><label>API credential <input type="password" autoComplete="off" value={secret} disabled={pending}
					onChange={(event) => setSecret(event.target.value)} /></label>
				<p>Credentials are stored in the operating system credential store. Leave blank to reuse a saved credential.</p>
				<label><input type="checkbox" checked={consent} disabled={pending} onChange={(event) => setConsent(event.target.checked)} />
					I allow selected document content and instructions to be sent to this endpoint. Workspace questions will send
					the question and retrieved excerpts with file and section names. Embeddings stay local.
				</label>
				</> : null}
				{error ? <p role="alert">{error}</p> : null}
				<div className="flex gap-2">
					<button type="submit" disabled={pending || (!local && !consent)}>Enable {local ? "local" : "remote"} provider</button>
					<button type="button" disabled={pending} onClick={() => void save(true)}>Disable AI</button>
					<button type="button" disabled={pending} onClick={onClose}>Close</button>
				</div>
			</form>
		</section>
	);
}

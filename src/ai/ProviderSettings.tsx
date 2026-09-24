import { useMemo, useRef, useState } from "react";
import { discoverOpenCode, testOpenCode, type OpenCodeModel, type OpenCodeStatus } from "./provider/opencode";
import { providerFailure } from "./provider/remote";
import { useAiSettings } from "./provider/settings";
import { useWorkspaceStore } from "../store/workspace";

type ProviderChoice = "opencode" | "remote" | "local";

function safeProviderMessage(error: unknown): string {
	const result = providerFailure(error);
	return result.ok ? "The provider is unavailable." : result.error.message;
}

export default function ProviderSettings({ onClose }: { workspace?: string; onClose(): void }) {
	const saved = useAiSettings((state) => state.deviceConfiguration);
	const workspace = useWorkspaceStore((state) => state.root);
	const initialChoice: ProviderChoice = saved?.kind === "opencode" ? "opencode" : saved?.kind ?? "opencode";
	const [choice, setChoice] = useState<ProviderChoice>(initialChoice);
	const [endpoint, setEndpoint] = useState(saved && saved.kind !== "opencode" ? saved.endpoint : "");
	const [model, setModel] = useState(saved?.model ?? "");
	const [secret, setSecret] = useState("");
	const [consent, setConsent] = useState(saved?.remoteConsent ?? false);
	const [pending, setPending] = useState(false);
	const [testing, setTesting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [openCode, setOpenCode] = useState<OpenCodeStatus | null>(null);
	const testController = useRef<AbortController | null>(null);
	const selectedOpenCode = useMemo(
		() => openCode?.models.find((candidate) => `${candidate.providerId}/${candidate.id}` === model) ?? null,
		[model, openCode],
	);

	async function detectOpenCode() {
		setPending(true);
		setError(null);
		setNotice(null);
		try {
			const status = await discoverOpenCode(workspace);
			setOpenCode(status);
			const configuredAvailable = status.models.some((candidate) => `${candidate.providerId}/${candidate.id}` === model);
			if (!configuredAvailable) {
				const free = status.models.find((candidate) => !candidate.mayCost);
				const first = free ?? status.models[0];
				setModel(`${first.providerId}/${first.id}`);
				setConsent(first.local);
			}
			setNotice(`OpenCode ${status.version} detected with ${status.models.length} usable model${status.models.length === 1 ? "" : "s"}.`);
		} catch (error) {
			setOpenCode(null);
			setError(safeProviderMessage(error));
		} finally {
			setPending(false);
		}
	}

	async function testConnection() {
		if (!model || (choice === "opencode" && !selectedOpenCode)) return;
		setTesting(true);
		setError(null);
		setNotice(null);
		const controller = new AbortController();
		testController.current = controller;
		try {
			if (choice === "opencode") {
				await testOpenCode(model, workspace, controller.signal);
				setNotice("Connection test passed with synthetic text. No document content was sent.");
			} else {
				setNotice("Save this provider, then use an AI action to verify it. The credential is never sent to the webview again.");
			}
		} catch (error) {
			setError(safeProviderMessage(error));
		} finally {
			testController.current = null;
			setTesting(false);
		}
	}

	async function save(disable: boolean) {
		setPending(true);
		setError(null);
		try {
			const settings = useAiSettings.getState();
			if (disable) await settings.disable();
			else if (choice === "opencode") {
				if (!selectedOpenCode) throw new Error("Select a discovered OpenCode model.");
				await settings.configureOpenCode(model, selectedOpenCode.local, consent);
			} else if (choice === "local") await settings.configureLocal(endpoint, model);
			else await settings.configureRemote({ endpoint, model, remoteConsent: consent }, secret);
			onClose();
		} catch (error) {
			setError(safeProviderMessage(error));
		} finally {
			setSecret("");
			setPending(false);
		}
	}

	const remote = choice === "remote" || (choice === "opencode" && selectedOpenCode !== null && !selectedOpenCode.local);
	const canEnable = choice === "opencode"
		? selectedOpenCode !== null && (!remote || consent)
		: Boolean(endpoint && model && (choice === "local" || consent));

	return (
		<section role="dialog" aria-label="AI provider settings" className="markflow-provider-settings">
			<header>
				<div><span>Beta</span><h2>AI provider — this device</h2></div>
				<button type="button" disabled={pending || testing} onClick={onClose}>Close</button>
			</header>
			<p>AI is optional. OpenCode can reuse accounts you connected through its supported login flow; Markflow never reads or stores those passwords or tokens.</p>
			<form onSubmit={(event) => { event.preventDefault(); void save(false); }}>
				<label>Connection
					<select disabled={pending || testing} value={choice} onChange={(event) => {
						const next = event.target.value as ProviderChoice;
						setChoice(next); setConsent(false); setError(null); setNotice(null);
						if (next === "local") setEndpoint("http://127.0.0.1:8080/v1/chat/completions");
					}}>
						<option value="opencode">OpenCode account or model (recommended)</option>
						<option value="local">Local llama.cpp server</option>
						<option value="remote">Direct remote API</option>
					</select>
				</label>

				{choice === "opencode" ? <div className="markflow-provider-card">
					<p>First connect an account in OpenCode with <code>/connect</code>. ChatGPT Plus/Pro, Copilot or other methods appear only when your OpenCode version and account support them. OpenCode Go is not required.</p>
					<button type="button" disabled={pending || testing} onClick={() => void detectOpenCode()}>{openCode ? "Refresh models" : "Detect OpenCode"}</button>
					{openCode ? <label>OpenCode model
						<select required value={model} disabled={pending || testing} onChange={(event) => {
							setModel(event.target.value);
							const next = openCode.models.find((candidate) => `${candidate.providerId}/${candidate.id}` === event.target.value);
							setConsent(Boolean(next?.local));
						}}>
							{openCode.models.map((candidate) => <ModelOption key={`${candidate.providerId}/${candidate.id}`} model={candidate} />)}
						</select>
					</label> : null}
					{selectedOpenCode ? <p className="markflow-provider-provenance">
						{selectedOpenCode.local ? "Runs locally" : "Uses your connected OpenCode account"}
						{" · "}{selectedOpenCode.mayCost ? "Provider usage may incur cost" : "Catalog currently reports zero model cost"}
					</p> : null}
				</div> : <>
					{choice === "local" ? <p>Start llama-server with your model. Only literal loopback addresses are accepted; no proxy is used.</p> : null}
					<label>Chat-completions endpoint <input type="url" required value={endpoint} disabled={pending || testing}
						onChange={(event) => { setEndpoint(event.target.value); setConsent(false); }} /></label>
					<label>Model <input required value={model} disabled={pending || testing} onChange={(event) => setModel(event.target.value)} /></label>
					{choice === "remote" ? <><label>API credential <input type="password" autoComplete="off" value={secret} disabled={pending || testing}
						onChange={(event) => setSecret(event.target.value)} /></label>
					<p>Credentials are stored only in the operating system credential store. Leave blank to reuse one already saved.</p></> : null}
				</>}

				{remote ? <label className="markflow-provider-consent"><input type="checkbox" checked={consent} disabled={pending || testing} onChange={(event) => setConsent(event.target.checked)} />
					I allow selected document content and instructions to be sent to this remote model. Workspace questions also send the question and retrieved excerpts. Embeddings stay local.
				</label> : null}
				{error ? <p role="alert" className="markflow-provider-error">{error}</p> : null}
				{notice ? <p role="status" className="markflow-provider-notice">{notice}</p> : null}
				<div className="markflow-provider-actions">
					{testing ? <button type="button" onClick={() => testController.current?.abort()}>Cancel test</button>
						: <button type="button" disabled={pending || !model || (choice === "opencode" && !selectedOpenCode)} onClick={() => void testConnection()}>Test connection</button>}
					<button type="submit" className="markflow-mode-action" disabled={pending || testing || !canEnable}>Enable provider</button>
					<button type="button" disabled={pending || testing} onClick={() => void save(true)}>Disable AI</button>
				</div>
			</form>
		</section>
	);
}

function ModelOption({ model }: { model: OpenCodeModel }) {
	const value = `${model.providerId}/${model.id}`;
	return <option value={value}>{model.name} — {model.providerId}{model.local ? " · local" : model.mayCost ? " · may cost" : " · zero catalog cost"}</option>;
}

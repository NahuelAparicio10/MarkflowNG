import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { openCitation } from "./citations";
import { DEVICE_PROVIDER_SCOPE, useAiSettings } from "./provider/settings";
import { useAiWorkspace, startIndex } from "./workspace";

export default function AiPanel({ root, onSettings, onOpenWorkspace }: { root: string | null; onSettings(): void; onOpenWorkspace(): void }) {
	const provider = useAiSettings((state) => state.providers.get(DEVICE_PROVIDER_SCOPE));
	const progress = useAiWorkspace((state) => root ? state.progress.get(root) : undefined);
	const answers = useAiWorkspace((state) => root ? state.answers.get(root) : undefined);
	const pending = useAiWorkspace((state) => root ? state.pending.has(root) : false);
	const [question, setQuestion] = useState("");
	const [installing, setInstalling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function download() {
		if (!root) return;
		setInstalling(true); setError(null);
		try { await invoke("install_embedding_model", { root }); startIndex(root); }
		catch { setError("Could not download the embedding model. Check the connection and try again."); }
		finally { setInstalling(false); }
	}

	return (
		<aside className="markflow-ai-panel" aria-label="Workspace AI assistant">
			<header><span>AI workspace</span><h2>Ask your notes</h2><p>Answers use saved files and include source links.</p></header>
			{!provider ? <section className="markflow-ai-empty"><p>Connect an AI provider to start using assisted writing and workspace questions.</p><button type="button" onClick={onSettings}>Configure provider</button></section> : null}
			{!root ? <section className="markflow-ai-empty"><p>Open a folder to ask questions across a workspace. Selection commands still work in this document.</p><button type="button" onClick={onOpenWorkspace}>Open workspace</button></section> : provider ? <>
				<p className="markflow-ai-status" role="status">{installing ? "Downloading local embedding model…" : progress?.ready ? "Index up to date" : `Indexing ${progress?.completed ?? 0}/${progress?.total ?? 0}${progress?.paused ? " · paused" : ""}`}</p>
				{progress?.error ? <p role="alert">{progress.error}</p> : null}
				{error ? <p role="alert">{error}</p> : null}
				<div className="markflow-ai-actions">
					<button type="button" disabled={installing} onClick={() => void download()}>Download local embeddings (~90 MB)</button>
					<button type="button" disabled={!progress} onClick={() => void invoke("pause_index", { root, paused: !progress?.paused }).catch(() => setError("Could not change indexing state."))}>{progress?.paused ? "Resume" : "Pause"}</button>
				</div>
				<p className="text-sm">Model download is a one-time setup. Indexing then works offline. Excerpts reflect saved files.</p>
				<form className="markflow-ai-form" onSubmit={(event) => { event.preventDefault(); void useAiWorkspace.getState().ask(root, question); setQuestion(""); }}>
					<label><span>Question</span><textarea placeholder="What do these notes say about…" value={question} disabled={pending} onChange={(event) => setQuestion(event.target.value)} /></label>
					<button type="submit" disabled={pending || !question.trim()}>{pending ? "Answering…" : "Ask"}</button>
				</form>
			</> : null}
			{root ? answers?.map((answer, index) => <article key={index} className="markflow-ai-answer">
				<h3>{answer.question}</h3>
				{answer.incomplete ? <p role="status">Indexing is incomplete; this answer uses the files indexed so far.</p> : null}
				<p className="whitespace-pre-wrap">{answer.text}</p>
				<ul>{answer.citations.map((citation, index) => <li key={index}><button type="button" onClick={() => void openCitation(root, citation)}>
					{citation.file} — {citation.headings.join(" / ") || "Document start"}
				</button></li>)}</ul>
			</article>) : null}
		</aside>
	);
}

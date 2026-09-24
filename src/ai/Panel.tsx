import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { openCitation } from "./citations";
import { useAiSettings } from "./provider/settings";
import { useAiWorkspace, startIndex } from "./workspace";

export default function AiPanel({ root, onSettings }: { root: string; onSettings(): void }) {
	const provider = useAiSettings((state) => state.providers.get(root));
	const progress = useAiWorkspace((state) => state.progress.get(root));
	const answers = useAiWorkspace((state) => state.answers.get(root));
	const pending = useAiWorkspace((state) => state.pending.has(root));
	const [question, setQuestion] = useState("");
	const [installing, setInstalling] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function download() {
		setInstalling(true); setError(null);
		try { await invoke("install_embedding_model", { root }); startIndex(root); }
		catch { setError("Could not download the embedding model. Check the connection and try again."); }
		finally { setInstalling(false); }
	}

	return (
		<aside className="w-96 shrink-0 overflow-auto border-l p-4" aria-label="Workspace AI assistant">
			<h2>Ask this workspace</h2>
			{!provider ? <><p>Configure a provider to ask questions.</p><button type="button" onClick={onSettings}>Configure provider</button></> : <>
				<p role="status">{installing ? "Downloading local embedding model…" : progress?.ready ? "Index up to date" : `Indexing: ${progress?.completed ?? 0}/${progress?.total ?? 0} files${progress?.paused ? " (paused)" : ""}`}</p>
				{progress?.error ? <p role="alert">{progress.error}</p> : null}
				{error ? <p role="alert">{error}</p> : null}
				<div className="flex gap-2">
					<button type="button" disabled={installing} onClick={() => void download()}>Download local embeddings (~90 MB)</button>
					<button type="button" disabled={!progress} onClick={() => void invoke("pause_index", { root, paused: !progress?.paused }).catch(() => setError("Could not change indexing state."))}>{progress?.paused ? "Resume" : "Pause"}</button>
				</div>
				<p className="text-sm">Model download is a one-time setup. Indexing then works offline. Excerpts reflect saved files.</p>
				<form onSubmit={(event) => { event.preventDefault(); void useAiWorkspace.getState().ask(root, question); setQuestion(""); }}>
					<label>Question<textarea value={question} disabled={pending} onChange={(event) => setQuestion(event.target.value)} /></label>
					<button type="submit" disabled={pending || !question.trim()}>{pending ? "Answering…" : "Ask"}</button>
				</form>
			</>}
			{answers?.map((answer, index) => <article key={index} className="mt-4 border-t pt-2">
				<h3>{answer.question}</h3>
				{answer.incomplete ? <p role="status">Indexing is incomplete; this answer uses the files indexed so far.</p> : null}
				<p className="whitespace-pre-wrap">{answer.text}</p>
				<ul>{answer.citations.map((citation, index) => <li key={index}><button type="button" onClick={() => void openCitation(root, citation)}>
					{citation.file} — {citation.headings.join(" / ") || "Document start"}
				</button></li>)}</ul>
			</article>)}
		</aside>
	);
}

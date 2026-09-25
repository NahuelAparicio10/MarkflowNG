import type { AiSuggestion } from "../editor/slashMenu/types";

export default function AiReview({ suggestion, onResolve }: { suggestion: AiSuggestion; onResolve(accept: boolean): void }) {
	return (
		<section role="dialog" aria-label="Review AI suggestion" className="border p-4"
			onKeyDown={(event) => { if (event.key === "Escape") onResolve(false); }}>
			<h2>Review AI suggestion</h2>
			{suggestion.error ? <p role="alert">{suggestion.error}</p> : null}
			<div className="grid grid-cols-2 gap-4">
				<div><h3>− Removed (original selection)</h3><pre className="whitespace-pre-wrap"><del>{suggestion.original}</del></pre></div>
				<div><h3>+ Added (raw replacement)</h3><pre className="whitespace-pre-wrap"><ins>{suggestion.replacement}</ins></pre></div>
			</div>
			<div className="mt-4 flex gap-2">
				<button type="button" disabled={!!suggestion.error} onClick={() => onResolve(true)}>Accept</button>
				<button type="button" onClick={() => onResolve(false)}>Reject</button>
			</div>
		</section>
	);
}

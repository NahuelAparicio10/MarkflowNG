import { useState } from "react";

export default function CodeBlock({ value, language }: { value: string; language: string | null | undefined }) {
	const [copied, setCopied] = useState(false);
	const label = language?.trim() || "Code";

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1200);
		} catch {
			setCopied(false);
		}
	}

	return <div className="markflow-code-block">
		<div className="markflow-code-header"><span data-language={label} aria-hidden="true" /><button type="button" aria-label="Copy code" title={copied ? "Copied" : "Copy code"} onClick={() => void copy()}>
			{copied ? "✓" : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>}
		</button></div>
		<pre data-language={label}><code className={language ? `language-${language}` : undefined}>{value}</code></pre>
	</div>;
}

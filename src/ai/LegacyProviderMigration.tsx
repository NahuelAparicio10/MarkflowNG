import { useState } from "react";
import { useAiSettings } from "./provider/settings";

export default function LegacyProviderMigration({ onConfigure }: { onConfigure(): void }) {
	const providers = useAiSettings((state) => state.legacyConfigurations);
	const error = useAiSettings((state) => state.migrationError);
	const [pending, setPending] = useState<string | null>(null);
	const migrate = async (workspace: string) => {
		setPending(workspace);
		try { await useAiSettings.getState().migrateLegacy(workspace); }
		catch {
			useAiSettings.setState({ migrationError: "Could not migrate this saved provider. Check its stored credential or configure a provider again." });
		}
		finally { setPending(null); }
	};

	return (
		<section role="dialog" aria-modal="true" aria-label="Choose saved AI provider" className="border-b p-4">
			<h2>Choose a saved AI provider</h2>
			<p>Older provider settings were saved per workspace. Choose one to use across this device. Other saved entries are retained for recovery.</p>
			{error ? <p role="alert">{error}</p> : null}
			<ul className="my-3 flex flex-col gap-2">
				{Object.entries(providers).map(([workspace, config]) => (
					<li key={workspace} className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate">{workspace} · {config.kind} · {config.model}</span>
						<button type="button" disabled={pending !== null} onClick={() => void migrate(workspace)}>
							{pending === workspace ? "Migrating…" : "Use this provider"}
						</button>
					</li>
				))}
			</ul>
			<button type="button" onClick={onConfigure}>Configure a new provider instead</button>
		</section>
	);
}

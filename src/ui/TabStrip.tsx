import { useSessionStore } from "../store/session";
import { useWorkspaceStore } from "../store/workspace";
import { closeTab } from "./closeTab";

/**
 * The open documents, one tab each, the active one highlighted. A dirty
 * document is marked with `●` on its own tab only. Middle-click closes, as in
 * most tabbed editors.
 */
export default function TabStrip() {
	const documents = useSessionStore((state) => state.documents);
	const activePath = useSessionStore((state) => state.activePath);
	const activateDocument = useSessionStore((state) => state.activateDocument);

	if (documents.length === 0) {
		return null;
	}

	function activate(path: string) {
		activateDocument(path);
		// Choosing a tab leaves any preview for the document it shows.
		useWorkspaceStore.getState().setPreview(null);
	}

	return (
		<div className="markflow-tabs" role="tablist" aria-label="Open documents">
			{documents.map((document) => {
				const isActive = document.path === activePath;
				return (
					<div
						key={document.path}
						role="tab"
						aria-selected={isActive}
						title={document.path}
						className={isActive ? "markflow-tab markflow-tab-active" : "markflow-tab"}
						onClick={() => activate(document.path)}
						onAuxClick={(event) => {
							if (event.button === 1) {
								void closeTab(document.path);
							}
						}}
					>
						<span className="markflow-tab-name">
							{document.dirty ? <span className="markflow-tab-dirty" aria-label="unsaved changes">● </span> : null}
							{document.name}
						</span>
						<button
							type="button"
							className="markflow-tab-close"
							aria-label={`Close ${document.name}`}
							onClick={(event) => {
								event.stopPropagation();
								void closeTab(document.path);
							}}
						>
							×
						</button>
					</div>
				);
			})}
		</div>
	);
}

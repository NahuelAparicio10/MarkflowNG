import { resolveConflict } from "../explorer/externalChanges";
import type { OpenDocument } from "../store/session";

interface ExternalChangeBannerProps {
	document: OpenDocument;
}

/**
 * Tells the user that the active document changed or disappeared on disk and
 * asks what to do. Until one of the buttons is pressed nothing is written or
 * discarded — autosave and Ctrl+S are held back (see `savePolicy.ts`).
 */
export default function ExternalChangeBanner({ document }: ExternalChangeBannerProps) {
	const { conflict, name, path } = document;
	if (!conflict) {
		return null;
	}

	if (conflict.kind === "modified") {
		return (
			<div role="alert" className="markflow-conflict">
				<p>
					<strong>{name}</strong> was changed on disk by another program, and you have unsaved changes. Which
					version do you want to keep?
				</p>
				<div className="markflow-conflict-actions">
					<button type="button" onClick={() => void resolveConflict(path, "keep-local")}>
						Keep my version
					</button>
					<button type="button" onClick={() => void resolveConflict(path, "reload-from-disk")}>
						Reload from disk
					</button>
				</div>
			</div>
		);
	}

	return (
		<div role="alert" className="markflow-conflict">
			<p>
				<strong>{name}</strong> was deleted on disk. Its content is still here and can be saved again.
			</p>
			<div className="markflow-conflict-actions">
				<button type="button" onClick={() => void resolveConflict(path, "keep-local")}>
					Save it again
				</button>
				<button type="button" onClick={() => void resolveConflict(path, "close")}>
					Close
				</button>
			</div>
		</div>
	);
}

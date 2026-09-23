import { useEffect, useState } from "react";
import EditorView from "./editor/EditorView";
import OutlinePanel from "./reader/OutlinePanel";
import ReaderView from "./reader/ReaderView";
import RawView from "./reader/RawView";
import { openFileDialog } from "./store/openFile";
import { useSessionStore } from "./store/session";
import { useModeShortcut } from "./ui/useModeShortcut";
import { syncWindowTitle } from "./ui/windowTitle";

export default function App() {
	const filePath = useSessionStore((state) => state.filePath);
	const fileName = useSessionStore((state) => state.fileName);
	const tree = useSessionStore((state) => state.tree);
	const mode = useSessionStore((state) => state.mode);
	const error = useSessionStore((state) => state.error);
	const dirty = useSessionStore((state) => state.dirty);
	const [outlineOpen, setOutlineOpen] = useState(false);

	useModeShortcut();

	useEffect(() => {
		syncWindowTitle(fileName, dirty);
	}, [fileName, dirty]);

	return (
		<div className="flex h-full flex-col">
			<header className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-2 dark:border-white/10">
				<div className="flex items-center gap-2">
					<button type="button" onClick={() => void openFileDialog()}>
						Open…
					</button>
					{tree ? (
						<button
							type="button"
							aria-pressed={outlineOpen}
							onClick={() => setOutlineOpen((open) => !open)}
						>
							Outline
						</button>
					) : null}
				</div>
				<span className="truncate text-sm opacity-70">
					{dirty ? "● " : ""}
					{fileName ?? "No document open"}
				</span>
			</header>

			{error ? <p className="border-b border-black/10 px-4 py-2 text-sm text-red-600 dark:border-white/10">{error}</p> : null}

			<main className="flex flex-1 overflow-hidden">
				{outlineOpen && tree ? (
					<aside className="w-64 shrink-0 overflow-auto border-r border-black/10 p-4 dark:border-white/10">
						<OutlinePanel />
					</aside>
				) : null}

				<div className="flex-1 overflow-auto">
					{!tree ? <EmptyState /> : null}

					{/* The editor stays mounted for as long as the file is open, even
					    while another mode is shown, so switching away and back never
					    discards an in-progress edit — see EditorView.tsx. */}
					{filePath ? (
						<div className={mode === "editor" ? "h-full" : "hidden"}>
							<EditorView key={filePath} filePath={filePath} />
						</div>
					) : null}

					{tree && mode !== "editor" ? (
						mode === "raw" ? <RawView tree={tree} /> : <ReaderView />
					) : null}
				</div>
			</main>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-semibold">Markflow</h1>
				<p className="mt-2 text-sm opacity-70">Write documents visually, get clean Markdown files.</p>
				<button type="button" className="mt-4" onClick={() => void openFileDialog()}>
					Open a Markdown file…
				</button>
			</div>
		</div>
	);
}

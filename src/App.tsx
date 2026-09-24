import { useCallback, useEffect, useState } from "react";
import ProviderSettings from "./ai/ProviderSettings";
import AiPanel from "./ai/Panel";
import { startIndex } from "./ai/workspace";
import { useAiSettings } from "./ai/provider/settings";
import EditorView from "./editor/EditorView";
import FileTree from "./explorer/FileTree";
import { openFolderDialog } from "./explorer/openWorkspace";
import { baseName, joinWorkspacePath } from "./explorer/paths";
import Preview from "./explorer/Preview";
import QuickOpen from "./explorer/QuickOpen";
import { useQuickOpenShortcut } from "./explorer/useQuickOpenShortcut";
import OutlinePanel from "./reader/OutlinePanel";
import ReaderView from "./reader/ReaderView";
import RawView from "./reader/RawView";
import { openFileAtPath, openFileDialog } from "./store/openFile";
import { selectActiveDocument, useSessionStore } from "./store/session";
import { useSettingsStore } from "./store/settings";
import { useWorkspaceStore } from "./store/workspace";
import ExternalChangeBanner from "./ui/ExternalChangeBanner";
import TabStrip from "./ui/TabStrip";
import { useModeShortcut } from "./ui/useModeShortcut";
import { syncWindowTitle } from "./ui/windowTitle";

export default function App() {
	const documents = useSessionStore((state) => state.documents);
	const active = useSessionStore(selectActiveDocument);
	const error = useSessionStore((state) => state.error);
	const notice = useSessionStore((state) => state.notice);
	const workspaceRoot = useWorkspaceStore((state) => state.root);
	const scanning = useWorkspaceStore((state) => state.scanning);
	const previewPath = useWorkspaceStore((state) => state.previewPath);
	const [outlineOpen, setOutlineOpen] = useState(false);
	const [quickOpenShown, setQuickOpenShown] = useState(false);
	const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(false);
	const aiProvider = useAiSettings((state) => workspaceRoot ? state.providers.get(workspaceRoot) : undefined);
	useEffect(() => { void useAiSettings.getState().restore(); }, []);
	useEffect(() => {
		if (workspaceRoot && aiProvider) return startIndex(workspaceRoot);
	}, [workspaceRoot, aiProvider]);

	const fileName = active ? active.name : null;
	const tree = active ? active.tree : null;
	const mode = active ? active.mode : "reader";
	const dirty = active ? active.dirty : false;
	const isPreviewing = previewPath !== null && workspaceRoot !== null;

	useModeShortcut();
	useQuickOpenShortcut(
		useCallback(() => setQuickOpenShown(true), []),
		workspaceRoot !== null,
	);

	useEffect(() => {
		syncWindowTitle(fileName, dirty);
	}, [fileName, dirty]);

	const openWorkspaceFile = useCallback(
		(relativePath: string) => {
			if (workspaceRoot === null) {
				return;
			}
			const workspace = useWorkspaceStore.getState();
			workspace.setPreview(null);
			workspace.select(relativePath);
			void openFileAtPath(joinWorkspacePath(workspaceRoot, relativePath));
		},
		[workspaceRoot],
	);

	return (
		<div className="flex h-full flex-col">
			<header className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-2 dark:border-white/10">
				<div className="flex items-center gap-2">
					<button type="button" onClick={() => void openFileDialog()}>
						Open…
					</button>
					<button type="button" onClick={() => void openFolderDialog()}>
						Open folder…
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
					{mode === "editor" && active ? <InputRulesToggle /> : null}
					<button type="button" disabled={!workspaceRoot} onClick={() => setAiSettingsOpen((open) => !open)}>AI settings</button>
					<button type="button" disabled={!workspaceRoot} onClick={() => setAiPanelOpen((open) => !open)}>AI assistant</button>
					{aiProvider?.kind === "remote" ? <span role="status">Remote AI active</span> : null}
				</div>
				<span className="truncate text-sm opacity-70">
					{dirty ? "● " : ""}
					{fileName ?? "No document open"}
				</span>
			</header>

			<TabStrip />
			{aiSettingsOpen && workspaceRoot ? <ProviderSettings key={workspaceRoot} workspace={workspaceRoot} onClose={() => setAiSettingsOpen(false)} /> : null}

			{error ? <p className="border-b border-black/10 px-4 py-2 text-sm text-red-600 dark:border-white/10">{error}</p> : null}

			{notice ? (
				<p role="status" className="flex items-center justify-between gap-4 border-b border-black/10 px-4 py-2 text-sm dark:border-white/10">
					<span>{notice}</span>
					<button type="button" onClick={() => useSessionStore.getState().setNotice(null)}>
						Dismiss
					</button>
				</p>
			) : null}

			{active && !isPreviewing ? <ExternalChangeBanner document={active} /> : null}

			<main className="flex flex-1 overflow-hidden">
				{workspaceRoot !== null ? (
					<aside className="markflow-explorer">
						<div className="markflow-explorer-title" title={workspaceRoot}>
							{baseName(workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "")) || workspaceRoot}
							{scanning ? <span className="markflow-explorer-scanning"> · scanning…</span> : null}
						</div>
						<FileTree onOpen={openWorkspaceFile} />
					</aside>
				) : null}

				{outlineOpen && tree && !isPreviewing ? (
					<aside className="w-64 shrink-0 overflow-auto border-r border-black/10 p-4 dark:border-white/10">
						<OutlinePanel />
					</aside>
				) : null}

				<div className="flex-1 overflow-auto">
					{isPreviewing ? (
						<Preview
							path={joinWorkspacePath(workspaceRoot, previewPath)}
							onOpen={() => openWorkspaceFile(previewPath)}
						/>
					) : null}

					{!tree && !isPreviewing ? <EmptyState hasWorkspace={workspaceRoot !== null} /> : null}

					{/* One editor per open document, each mounted for as long as its
					    tab is open, even while another tab, mode or a preview is
					    shown, so switching away and back never discards an
					    in-progress edit, its undo history or its caret — see
					    EditorView.tsx. */}
					{documents.map((document) => {
						const isActive = document.path === active?.path;
						const isVisible = isActive && document.mode === "editor" && !isPreviewing;
						return (
							<div key={document.path} className={isVisible ? "h-full" : "hidden"}>
								<EditorView
									filePath={document.path}
									isActive={isActive}
									isVisible={isVisible}
									revision={document.revision}
								/>
							</div>
						);
					})}

					{tree && mode !== "editor" && !isPreviewing ? (
						mode === "raw" ? <RawView tree={tree} /> : <ReaderView />
					) : null}
				</div>
				{aiPanelOpen && workspaceRoot ? <AiPanel key={workspaceRoot} root={workspaceRoot} onSettings={() => setAiSettingsOpen(true)} /> : null}
			</main>

			{quickOpenShown ? (
				<QuickOpen onOpen={openWorkspaceFile} onClose={() => setQuickOpenShown(false)} />
			) : null}
		</div>
	);
}

/** The single opt-out for automatic Markdown conversion — design decision D3. */
function InputRulesToggle() {
	const enabled = useSettingsStore((state) => state.inputRulesEnabled);
	const setEnabled = useSettingsStore((state) => state.setInputRulesEnabled);

	return (
		<label className="flex items-center gap-1 text-sm">
			<input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
			Convert Markdown as I type
		</label>
	);
}

function EmptyState({ hasWorkspace }: { hasWorkspace: boolean }) {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="text-center">
				<h1 className="text-2xl font-semibold">Markflow</h1>
				<p className="mt-2 text-sm opacity-70">Write documents visually, get clean Markdown files.</p>
				{hasWorkspace ? (
					<p className="mt-4 text-sm opacity-70">Pick a file in the tree, or press Ctrl+P to find one.</p>
				) : (
					<div className="mt-4 flex justify-center gap-2">
						<button type="button" onClick={() => void openFileDialog()}>
							Open a Markdown file…
						</button>
						<button type="button" onClick={() => void openFolderDialog()}>
							Open a folder…
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

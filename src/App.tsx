import { useCallback, useEffect, useState } from "react";
import ProviderSettings from "./ai/ProviderSettings";
import LegacyProviderMigration from "./ai/LegacyProviderMigration";
import AiPanel from "./ai/Panel";
import { startIndex } from "./ai/workspace";
import { DEVICE_PROVIDER_SCOPE, useAiSettings } from "./ai/provider/settings";
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
import { useAppearanceStore } from "./store/appearance";
import { useWorkspaceStore } from "./store/workspace";
import ExternalChangeBanner from "./ui/ExternalChangeBanner";
import TabStrip from "./ui/TabStrip";
import ThemeSelector from "./ui/ThemeSelector";
import { useModeShortcut } from "./ui/useModeShortcut";
import { syncWindowTitle } from "./ui/windowTitle";
import { BookOpenIcon, CodeIcon, FileIcon, FolderOpenIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PencilIcon, SettingsIcon, SparklesIcon } from "./ui/icons";

export default function App() {
	const documents = useSessionStore((state) => state.documents);
	const active = useSessionStore(selectActiveDocument);
	const error = useSessionStore((state) => state.error);
	const notice = useSessionStore((state) => state.notice);
	const workspaceRoot = useWorkspaceStore((state) => state.root);
	const scanning = useWorkspaceStore((state) => state.scanning);
	const previewPath = useWorkspaceStore((state) => state.previewPath);
	const outlineOpen = useSettingsStore((state) => state.outlineOpen);
	const setOutlineOpen = useSettingsStore((state) => state.setOutlineOpen);
	const [quickOpenShown, setQuickOpenShown] = useState(false);
	const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(false);
	const theme = useAppearanceStore((state) => state.theme);
	const aiProvider = useAiSettings((state) => state.providers.get(DEVICE_PROVIDER_SCOPE));
	const legacyProviderConfigurations = useAiSettings((state) => state.legacyConfigurations);
	const deviceAiConfiguration = useAiSettings((state) => state.deviceConfiguration);
	const aiMigrationResolved = useAiSettings((state) => state.migrationResolved);
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
	useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
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
			<header className="markflow-app-toolbar">
				<div className="markflow-toolbar-section">
					<strong className="markflow-brand">Markflow</strong>
					<button type="button" className="markflow-toolbar-action" onClick={() => void openFileDialog()} title="Open Markdown file"><FileIcon /><span>Open</span></button>
					<button type="button" className="markflow-toolbar-action" onClick={() => void openFolderDialog()} title="Open workspace folder"><FolderOpenIcon /><span>Workspace</span></button>
				</div>
				<div className="markflow-toolbar-section markflow-toolbar-end">
					{active && !isPreviewing ? <div className="markflow-mode-switch" role="group" aria-label="Document view">
						<button type="button" aria-label="Read document" title="Read document" aria-pressed={mode === "reader"} onClick={() => useSessionStore.getState().setMode("reader")}><BookOpenIcon /></button>
						<button type="button" aria-label="View raw Markdown" title="View raw Markdown" aria-pressed={mode === "raw"} onClick={() => useSessionStore.getState().setMode("raw")}><CodeIcon /></button>
						<button type="button" aria-label="Edit document" title="Edit document (Ctrl+E)" aria-pressed={mode === "editor"} onClick={() => useSessionStore.getState().setMode("editor")}><PencilIcon /></button>
					</div> : null}
					<button type="button" className="markflow-icon-button" aria-label="AI settings" title="AI settings" onClick={() => setAiSettingsOpen((open) => !open)}><SettingsIcon /></button>
					<button type="button" className="markflow-icon-button" aria-label="AI assistant" title="AI assistant" aria-pressed={aiPanelOpen} onClick={() => setAiPanelOpen((open) => !open)}><SparklesIcon /></button>
					{aiProvider?.kind === "remote" ? <span className="markflow-remote-status" role="status" title="Remote AI active" aria-label="Remote AI active" /> : null}
					<span className="markflow-document-name">{dirty ? "● " : ""}{fileName ?? "No document open"}</span>
					<ThemeSelector />
				</div>
			</header>

			<TabStrip />
			{!deviceAiConfiguration && !aiMigrationResolved && Object.keys(legacyProviderConfigurations).length > 0
				? <LegacyProviderMigration onConfigure={() => setAiSettingsOpen(true)} /> : null}
			{aiSettingsOpen ? <ProviderSettings key="device-ai-settings" onClose={() => setAiSettingsOpen(false)} /> : null}

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

				{tree && !isPreviewing ? (
					<aside id="markflow-document-navigation" className={`markflow-document-nav${outlineOpen ? "" : " is-collapsed"}`}>
						<button type="button" className="markflow-nav-toggle" aria-expanded={outlineOpen} aria-controls="markflow-document-navigation-content"
							aria-label={outlineOpen ? "Hide document navigation" : "Show document navigation"}
							title={outlineOpen ? "Hide document navigation" : "Show document navigation"}
							onClick={() => setOutlineOpen(!outlineOpen)}>
							{outlineOpen ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
						</button>
						{outlineOpen ? <div id="markflow-document-navigation-content" className="markflow-document-nav-content"><OutlinePanel /></div> : null}
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
				{aiPanelOpen ? <AiPanel key={workspaceRoot ?? "no-workspace"} root={workspaceRoot} onSettings={() => setAiSettingsOpen(true)} onOpenWorkspace={() => void openFolderDialog()} /> : null}
			</main>

			{quickOpenShown ? (
				<QuickOpen onOpen={openWorkspaceFile} onClose={() => setQuickOpenShown(false)} />
			) : null}
		</div>
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

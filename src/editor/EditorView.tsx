import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import AiReview from "../ai/Review";
import { createReviewController } from "../ai/reviewController";
import type { AiSuggestion } from "./slashMenu/types";
import { selectDocument, useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import { useWorkspaceStore } from "../store/workspace";
import EditorToolbar from "../ui/EditorToolbar";
import LinkEditor from "../ui/LinkEditor";
import SlashMenu from "../ui/SlashMenu";
import { createDebouncedAutosave } from "./autosave";
import { AUTOSAVE_DEBOUNCE_MS } from "./constants";
import { serializeDoc } from "./documentText";
import { registerEditor, unregisterEditor, type EditorHandle } from "./editorRegistry";
import { createExtensions } from "./extensions";
import type { ImageInsertionContext } from "./imageInsertion";
import { loadDocument } from "./loadDocument";
import { saveDocument } from "./saveDocument";
import { shouldWrite } from "./savePolicy";
import { useOsImageDrop } from "./useOsImageDrop";
import { useSaveShortcut } from "./useSaveShortcut";

interface EditorViewProps {
	filePath: string;
	/** Whether this is the active tab: only it answers the save shortcut. */
	isActive: boolean;
	/** Whether the editor is on screen, i.e. active and in editor mode. */
	isVisible: boolean;
	/**
	 * The document's reload counter from the session store. A change means
	 * the file was reloaded from disk and the editor must rehydrate.
	 */
	revision: number;
}

/**
 * Mounts the editing engine for one open file and owns its whole
 * load/edit/save lifecycle. Kept mounted (see `App.tsx`) for as long as the
 * file stays open, even while the user is looking at the reader or raw
 * view, so switching modes never discards an in-progress edit — the
 * document lives in ProseMirror, not in the session store (design
 * decision D4).
 *
 * Keyed by `filePath` in `App.tsx`, and one is mounted per open document, so
 * each tab keeps its own ProseMirror instance — and with it its own undo
 * history and caret — across tab switches (design decision D7 of the
 * workspace-explorer change).
 */
export default function EditorView({ filePath, isActive, isVisible, revision }: EditorViewProps) {
	const setDirty = useSessionStore((state) => state.setDirty);
	const setError = useSessionStore((state) => state.setError);
	const setNotice = useSessionStore((state) => state.setNotice);
	const [saveFailure, setSaveFailure] = useState<string | null>(null);
	const [recoveryText, setRecoveryText] = useState<string | null>(null);

	// The text last written to (or read from) disk, for D7's dirty comparison.
	// A ref, not state: it must be current inside the debounced autosave
	// callback without retriggering effects on every change.
	const baselineRef = useRef<string>("");

	const [linkEditorOpen, setLinkEditorOpen] = useState(false);
	const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
	const [reviewController] = useState(() => createReviewController(setAiSuggestion));

	useEffect(() => () => reviewController.setVisible(false), [reviewController]);
	useEffect(() => {
		reviewController.setVisible(isVisible);
	}, [isVisible, reviewController]);

	// Images resolve against, and are written beside, this document. The
	// workspace root is read at insertion time, since a workspace can be
	// opened or closed while the document stays open.
	const [imageContext] = useState<ImageInsertionContext>(() => ({
		getDocumentPath: () => filePath,
		getWorkspaceRoot: () => useWorkspaceStore.getState().root,
		notify: (message, kind) => (kind === "error" ? setError(message) : setNotice(message)),
	}));

	// Built once per mounted editor. The input-rules setting is read through the
	// store on every keystroke rather than captured here, so toggling it takes
	// effect without rebuilding the editor.
	const [extensions] = useState(() =>
		createExtensions({
			isInputRulesEnabled: () => useSettingsStore.getState().inputRulesEnabled,
			onOpenLink: () => setLinkEditorOpen(true),
			images: imageContext,
			reviewAiSuggestion: reviewController.request,
		}),
	);

	const editor = useEditor({
		extensions,
		editable: true,
		editorProps: {
			attributes: { class: "markflow-prose markflow-editor" },
		},
	});

	const performSave = useCallback(async (options?: { force?: boolean }) => {
		if (!editor) {
			return;
		}

		const currentText = serializeDoc(editor.state.doc);
		// Recomputed here rather than trusted from the caller, so the guards
		// hold regardless of why save was invoked — see savePolicy.ts.
		const conflict = selectDocument(useSessionStore.getState(), filePath)?.conflict ?? null;
		if (!shouldWrite({ conflict, currentText, baselineText: baselineRef.current, force: options?.force })) {
			return;
		}

		try {
			const written = await saveDocument(filePath, editor.state.doc);
			baselineRef.current = written;
			setDirty(filePath, false);
			setSaveFailure(null);
			setRecoveryText(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setSaveFailure(message);
			setError(`Could not save "${filePath}": ${message}`);
			// D3's open question, resolved: offer the content as raw text so
			// it is recoverable even though the write failed. Nothing here is
			// lost — it only ever left memory as a failed write.
			setRecoveryText(currentText);
		}
	}, [editor, filePath, setDirty, setError]);

	const autosaveRef = useRef<ReturnType<typeof createDebouncedAutosave> | null>(null);
	useEffect(() => {
		const autosave = createDebouncedAutosave(() => void performSave(), AUTOSAVE_DEBOUNCE_MS);
		autosaveRef.current = autosave;
		return () => {
			autosave.cancel();
			autosaveRef.current = null;
		};
	}, [performSave]);

	// Load: reads the file, parses and maps it through the core, and
	// hydrates the editor — the only load path, see loadDocument.ts. Runs
	// once per mounted instance (component is keyed by filePath in App.tsx),
	// and again whenever the document is reloaded from disk (`revision`).
	useEffect(() => {
		if (!editor) {
			return;
		}

		let cancelled = false;

		void loadDocument(filePath).then(
			(doc) => {
				if (cancelled) {
					return;
				}
				// `doc` was built against the core's own `Schema` instance
				// (src/core/schema/), not the one Tiptap derives from
				// `extensions` for this editor. The two are structurally
				// equal (see extensions.test.ts) but not the same object, and
				// ProseMirror nodes are tied to their exact schema instance —
				// so this crosses that boundary via JSON, which Tiptap
				// reconstructs against its own schema.
				editor.commands.setContent(doc.toJSON(), { emitUpdate: false });
				baselineRef.current = serializeDoc(doc);
				setDirty(filePath, false);
			},
			(error: unknown) => {
				if (cancelled) {
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				setError(`Could not open "${filePath}" in the editor: ${message}`);
			},
		);

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editor, filePath, revision]);

	// Dirty detection is derived from content on every transaction (D7), and
	// drives the debounced autosave. It never writes document content back
	// into the session store — only the boolean.
	useEffect(() => {
		if (!editor) {
			return;
		}

		function handleUpdate() {
			if (!editor) {
				return;
			}
			const currentText = serializeDoc(editor.state.doc);
			const nowDirty = currentText !== baselineRef.current;
			setDirty(filePath, nowDirty);

			if (nowDirty) {
				autosaveRef.current?.schedule();
			} else {
				autosaveRef.current?.cancel();
			}
		}

		editor.on("update", handleUpdate);
		return () => {
			editor.off("update", handleUpdate);
		};
	}, [editor, filePath, setDirty]);

	useEffect(() => {
		const handle: EditorHandle = {
			getMarkdown() {
				return editor ? serializeDoc(editor.state.doc) : baselineRef.current;
			},
			saveNow(options) {
				autosaveRef.current?.cancel();
				return performSave(options);
			},
		};
		registerEditor(filePath, handle);
		return () => unregisterEditor(filePath, handle);
	}, [editor, filePath, performSave]);

	const handleExplicitSave = useCallback(() => {
		autosaveRef.current?.cancel();
		void performSave();
	}, [performSave]);

	useSaveShortcut(handleExplicitSave, editor !== null && isActive);
	useOsImageDrop(editor, isVisible, imageContext);

	// A hidden editor loses DOM focus; restore it on return so typing lands
	// at the caret the document was left with. `focus()` with no position
	// keeps the current selection rather than moving it.
	useEffect(() => {
		if (editor && isVisible) {
			editor.commands.focus();
		}
	}, [editor, isVisible]);

	return (
		<div className="markflow-editor-shell">
			{saveFailure ? (
				<div className="markflow-save-recovery">
					<p>Save failed: {saveFailure}. The unsaved content is shown below so nothing is lost.</p>
					{recoveryText !== null ? <pre>{recoveryText}</pre> : null}
				</div>
			) : null}
			{editor ? <EditorToolbar editor={editor} images={imageContext} onEditLink={() => setLinkEditorOpen(true)} /> : null}
			<EditorContent editor={editor} />
			{editor ? <SlashMenu editor={editor} /> : null}
			{aiSuggestion && isVisible ? <AiReview suggestion={aiSuggestion} onResolve={reviewController.resolve} /> : null}
			{linkEditorOpen && editor ? <LinkEditor editor={editor} onClose={() => setLinkEditorOpen(false)} /> : null}
		</div>
	);
}

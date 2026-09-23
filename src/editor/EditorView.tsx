import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "../store/session";
import { useSettingsStore } from "../store/settings";
import LinkEditor from "../ui/LinkEditor";
import { createDebouncedAutosave } from "./autosave";
import { AUTOSAVE_DEBOUNCE_MS } from "./constants";
import { serializeDoc } from "./documentText";
import { createExtensions } from "./extensions";
import { loadDocument } from "./loadDocument";
import { saveDocument } from "./saveDocument";
import { useSaveShortcut } from "./useSaveShortcut";

interface EditorViewProps {
	filePath: string;
}

/**
 * Mounts the editing engine for one open file and owns its whole
 * load/edit/save lifecycle. Kept mounted (see `App.tsx`) for as long as the
 * file stays open, even while the user is looking at the reader or raw
 * view, so switching modes never discards an in-progress edit — the
 * document lives in ProseMirror, not in the session store (design
 * decision D4).
 *
 * Keyed by `filePath` in `App.tsx`, so a different file gets a fresh editor
 * and reloads rather than reusing stale content.
 */
export default function EditorView({ filePath }: EditorViewProps) {
	const setDirty = useSessionStore((state) => state.setDirty);
	const setError = useSessionStore((state) => state.setError);
	const [saveFailure, setSaveFailure] = useState<string | null>(null);
	const [recoveryText, setRecoveryText] = useState<string | null>(null);

	// The text last written to (or read from) disk, for D7's dirty comparison.
	// A ref, not state: it must be current inside the debounced autosave
	// callback without retriggering effects on every change.
	const baselineRef = useRef<string>("");

	const [linkEditorOpen, setLinkEditorOpen] = useState(false);

	// Built once per mounted editor. The input-rules setting is read through the
	// store on every keystroke rather than captured here, so toggling it takes
	// effect without rebuilding the editor.
	const [extensions] = useState(() =>
		createExtensions({
			isInputRulesEnabled: () => useSettingsStore.getState().inputRulesEnabled,
			onOpenLink: () => setLinkEditorOpen(true),
		}),
	);

	const editor = useEditor({
		extensions,
		editable: true,
		editorProps: {
			attributes: { class: "markflow-prose markflow-editor" },
		},
	});

	const performSave = useCallback(async () => {
		if (!editor) {
			return;
		}

		const currentText = serializeDoc(editor.state.doc);
		// Guard: never write a document that already matches disk — see the
		// "Autosave skips clean documents" scenario. Recomputed here rather
		// than trusted from the caller, so this holds regardless of why save
		// was invoked.
		if (currentText === baselineRef.current) {
			return;
		}

		try {
			const written = await saveDocument(filePath, editor.state.doc);
			baselineRef.current = written;
			setDirty(false);
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
	// once per mounted instance (component is keyed by filePath in App.tsx).
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
				setDirty(false);
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
	}, [editor, filePath]);

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
			setDirty(nowDirty);

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
	}, [editor, setDirty]);

	const handleExplicitSave = useCallback(() => {
		autosaveRef.current?.cancel();
		void performSave();
	}, [performSave]);

	useSaveShortcut(handleExplicitSave, editor !== null);

	return (
		<div className="markflow-editor-shell">
			{saveFailure ? (
				<div className="markflow-save-recovery">
					<p>Save failed: {saveFailure}. The unsaved content is shown below so nothing is lost.</p>
					{recoveryText !== null ? <pre>{recoveryText}</pre> : null}
				</div>
			) : null}
			<EditorContent editor={editor} />
			{linkEditorOpen && editor ? <LinkEditor editor={editor} onClose={() => setLinkEditorOpen(false)} /> : null}
		</div>
	);
}

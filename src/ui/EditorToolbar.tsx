import { open } from "@tauri-apps/plugin-dialog";
import { redo, undo } from "@tiptap/pm/history";
import type { Command } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { TableAlignment } from "../core/schema";
import { toggleMarkCommand } from "../editor/commands";
import {
	activeBlock, activeListKind, insertHorizontalRule, insertWarningCallout,
	setCodeLanguage, setTextBlock, toggleList, wrapInBlock,
} from "../editor/formatting";
import { type ImageInsertionContext, insertImageFiles } from "../editor/imageInsertion";
import { insertImages, selectedImage, setImageAlt, setImageWidth } from "../editor/images";
import {
	activeColumnAlignment, addTableColumn, addTableRow, deleteTable, deleteTableColumn,
	deleteTableRow, insertTable, setColumnAlignment,
} from "../editor/tables";
import { IMAGE_EXTENSIONS } from "../images/assets";
import { useSettingsStore } from "../store/settings";
import { HelpIcon } from "./icons";

interface EditorToolbarProps {
	editor: Editor;
	images: ImageInsertionContext;
	onEditLink(): void;
}

const ALIGNMENTS: { value: TableAlignment; label: string }[] = [
	{ value: "left", label: "Left" }, { value: "center", label: "Centre" },
	{ value: "right", label: "Right" }, { value: null, label: "Default" },
];

export default function EditorToolbar({ editor, images, onEditLink }: EditorToolbarProps) {
	const state = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const alignment = activeColumnAlignment(current.state);
			const image = selectedImage(current.state);
			return {
				inTable: alignment !== undefined,
				alignment: alignment ?? null,
				image: image ? { pos: image.pos, alt: image.node.attrs.alt as string, width: image.node.attrs.width as number | null } : null,
				block: activeBlock(current.state),
				list: activeListKind(current.state),
				strong: current.isActive("strong"), emphasis: current.isActive("emphasis"),
				strikethrough: current.isActive("strikethrough"), inlineCode: current.isActive("inlineCode"),
				link: current.isActive("link"), canUndo: undo(current.state), canRedo: redo(current.state),
			};
		},
	});
	const [imageFormOpen, setImageFormOpen] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);

	function run(command: Command) {
		command(editor.state, editor.view.dispatch);
		editor.commands.focus();
	}

	return <div className="markflow-editor-toolbar" role="toolbar" aria-label="Markdown formatting">
		<div role="group" aria-label="Block style">
			<select aria-label="Text style" title="Text style" value={state.block.kind === "heading" ? `heading-${state.block.level}` : state.block.kind}
				onChange={(event) => {
					const [kind, level] = event.target.value.split("-");
					run(kind === "heading" ? setTextBlock("heading", { level: Number(level) }) : setTextBlock(kind as "paragraph" | "codeBlock", kind === "codeBlock" ? { language: null } : null));
				}}>
				<option value="paragraph">Paragraph</option>
				{[1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={`heading-${level}`}>Heading {level}</option>)}
				<option value="codeBlock">Code block</option>
			</select>
		</div>
		<div role="group" aria-label="Inline formatting">
			<FormatButton label="Bold" shortcut="Ctrl+B" pressed={state.strong} onRun={() => run(toggleMarkCommand("strong"))}><strong>B</strong></FormatButton>
			<FormatButton label="Italic" shortcut="Ctrl+I" pressed={state.emphasis} onRun={() => run(toggleMarkCommand("emphasis"))}><em>I</em></FormatButton>
			<FormatButton label="Strikethrough" shortcut="Ctrl+Shift+X" pressed={state.strikethrough} onRun={() => run(toggleMarkCommand("strikethrough"))}><s>S</s></FormatButton>
			<FormatButton label="Inline code" shortcut="Ctrl+Shift+E" pressed={state.inlineCode} onRun={() => run(toggleMarkCommand("inlineCode"))}>{"</>"}</FormatButton>
			<FormatButton label="Link" shortcut="Ctrl+K" pressed={state.link} onRun={onEditLink}>↗</FormatButton>
		</div>
		<div role="group" aria-label="Blocks and lists">
			<FormatButton label="Quote" onRun={() => run(wrapInBlock("blockquote"))}>❝</FormatButton>
			<FormatButton label="Warning callout" onRun={() => run(insertWarningCallout)}>!</FormatButton>
			<FormatButton label="Bulleted list" pressed={state.list === "bullet"} onRun={() => run(toggleList("bullet"))}>•≡</FormatButton>
			<FormatButton label="Numbered list" pressed={state.list === "ordered"} onRun={() => run(toggleList("ordered"))}>1≡</FormatButton>
			<FormatButton label="Task list" pressed={state.list === "task"} onRun={() => run(toggleList("task"))}>☑</FormatButton>
			<FormatButton label="Horizontal rule" onRun={() => run(insertHorizontalRule)}>―</FormatButton>
		</div>
		{state.block.kind === "codeBlock" ? <label className="markflow-code-language">Language <input key={state.block.language ?? ""} aria-label="Code language" placeholder="shell" defaultValue={state.block.language ?? ""} onBlur={(event) => run(setCodeLanguage(event.target.value.trim() || null))} /></label> : null}
		<div role="group" aria-label="Insert">
			<FormatButton label="Insert table" disabled={state.inTable} onRun={() => run(insertTable())}>▦</FormatButton>
			<FormatButton label="Insert image" pressed={imageFormOpen} onRun={() => setImageFormOpen((shown) => !shown)}>▧</FormatButton>
		</div>
		<div role="group" aria-label="History and help">
			<FormatButton label="Undo" shortcut="Ctrl+Z" disabled={!state.canUndo} onRun={() => run(undo)}>↶</FormatButton>
			<FormatButton label="Redo" shortcut="Ctrl+Y" disabled={!state.canRedo} onRun={() => run(redo)}>↷</FormatButton>
			<FormatButton label="Keyboard help" pressed={helpOpen} onRun={() => setHelpOpen((shown) => !shown)}><HelpIcon /></FormatButton>
		</div>

		{helpOpen ? <EditorHelp onClose={() => setHelpOpen(false)} /> : null}
		{imageFormOpen ? <ImageInsertForm editor={editor} images={images} onDone={() => setImageFormOpen(false)} /> : null}
		{state.inTable ? <TableControls alignment={state.alignment} run={run} /> : null}
		{state.image ? <ImageControls key={`${state.image.pos}:${state.image.alt}`} editor={editor} image={state.image} /> : null}
	</div>;
}

function FormatButton({ label, shortcut, pressed, disabled, onRun, children }: { label: string; shortcut?: string; pressed?: boolean; disabled?: boolean; onRun(): void; children: ReactNode }) {
	const title = shortcut ? `${label} (${shortcut})` : label;
	return <button type="button" className="markflow-format-button" aria-label={label} title={title} aria-pressed={pressed} disabled={disabled}
		onMouseDown={(event) => event.preventDefault()} onClick={onRun}>{children}</button>;
}

function EditorHelp({ onClose }: { onClose(): void }) {
	const enabled = useSettingsStore((state) => state.inputRulesEnabled);
	const setEnabled = useSettingsStore((state) => state.setInputRulesEnabled);
	return <div className="markflow-editor-help" role="dialog" aria-label="Markdown and keyboard help">
		<div className="markflow-popover-heading"><strong>Keyboard shortcuts</strong><button type="button" aria-label="Close help" onClick={onClose}>×</button></div>
		<dl><dt>Ctrl+B / Ctrl+I</dt><dd>Bold / italic</dd><dt>Ctrl+Shift+X</dt><dd>Strikethrough</dd><dt>Ctrl+Shift+E</dt><dd>Inline code</dd><dt>Ctrl+K</dt><dd>Link</dd><dt>Ctrl+E</dt><dd>Read / edit</dd><dt>Ctrl+P</dt><dd>Quick open</dd><dt>/</dt><dd>Insert blocks and AI commands</dd></dl>
		<label><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Convert Markdown as I type</label>
	</div>;
}

function TableControls({ alignment, run }: { alignment: TableAlignment; run(command: Command): void }) {
	return <div className="markflow-context-controls" role="group" aria-label="Table controls">
		<button type="button" onClick={() => run(addTableRow("before"))}>Row above</button><button type="button" onClick={() => run(addTableRow("after"))}>Row below</button><button type="button" onClick={() => run(deleteTableRow)}>Delete row</button>
		<button type="button" onClick={() => run(addTableColumn("before"))}>Column left</button><button type="button" onClick={() => run(addTableColumn("after"))}>Column right</button><button type="button" onClick={() => run(deleteTableColumn)}>Delete column</button>
		{ALIGNMENTS.map(({ value, label }) => <button key={label} type="button" aria-pressed={alignment === value} onClick={() => run(setColumnAlignment(value))}>{label}</button>)}
		<button type="button" onClick={() => run(deleteTable)}>Delete table</button>
	</div>;
}

function ImageInsertForm({ editor, images, onDone }: { editor: Editor; images: ImageInsertionContext; onDone(): void }) {
	const [url, setUrl] = useState("");
	function handleSubmit(event: FormEvent) { event.preventDefault(); const target = url.trim(); if (target) insertImages([{ src: target }])(editor.state, editor.view.dispatch); onDone(); editor.commands.focus(); }
	async function chooseFile() {
		try {
			const selected = await open({ multiple: false, filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }] });
			if (typeof selected === "string") insertImageFiles(editor.view, [selected], undefined, images);
		} catch (error) { images.notify(`Could not open the file dialog: ${error instanceof Error ? error.message : String(error)}`, "error"); }
		onDone(); editor.commands.focus();
	}
	return <form className="markflow-toolbar-popover" role="group" aria-label="Insert image" onSubmit={handleSubmit}>
		<button type="button" onClick={() => void chooseFile()}>Choose file…</button><input autoFocus type="text" placeholder="or an image URL" aria-label="Image URL" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") onDone(); }} /><button type="submit">Insert</button>
	</form>;
}

function ImageControls({ editor, image }: { editor: Editor; image: { pos: number; alt: string; width: number | null } }) {
	const [alt, setAlt] = useState(image.alt);
	function commitAlt() { if (alt !== image.alt) setImageAlt(image.pos, alt)(editor.state, editor.view.dispatch); }
	return <div className="markflow-context-controls" role="group" aria-label="Image">
		<label>Alt text <input type="text" aria-label="Alt text" value={alt} onChange={(event) => setAlt(event.target.value)} onBlur={commitAlt} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitAlt(); editor.commands.focus(); } }} /></label>
		<span>{image.width === null ? "Original size" : `${image.width}px wide`}</span>{image.width !== null ? <button type="button" onClick={() => setImageWidth(image.pos, null)(editor.state, editor.view.dispatch)}>Reset size</button> : null}
	</div>;
}

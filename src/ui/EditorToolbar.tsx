import { open } from "@tauri-apps/plugin-dialog";
import type { Command } from "@tiptap/pm/state";
import { type Editor, useEditorState } from "@tiptap/react";
import { type FormEvent, useState } from "react";
import type { TableAlignment } from "../core/schema";
import { IMAGE_EXTENSIONS } from "../images/assets";
import { type ImageInsertionContext, insertImageFiles } from "../editor/imageInsertion";
import { insertImages, selectedImage, setImageAlt, setImageWidth } from "../editor/images";
import {
	activeColumnAlignment,
	addTableColumn,
	addTableRow,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	insertTable,
	setColumnAlignment,
} from "../editor/tables";

interface EditorToolbarProps {
	editor: Editor;
	images: ImageInsertionContext;
}

const ALIGNMENTS: { value: TableAlignment; label: string }[] = [
	{ value: "left", label: "Left" },
	{ value: "center", label: "Centre" },
	{ value: "right", label: "Right" },
	{ value: null, label: "Default" },
];

/**
 * Inserting tables and images, and the controls for the one the selection is
 * in. Table controls appear only inside a table, image controls only with an
 * image selected, so the bar stays short while writing prose.
 *
 * There is deliberately no merge or split control: GFM cannot hold a merged
 * cell, so the operation is not offered (design decision D2).
 */
export default function EditorToolbar({ editor, images }: EditorToolbarProps) {
	const { inTable, alignment, image } = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			const alignment = activeColumnAlignment(current.state);
			const image = selectedImage(current.state);

			return {
				inTable: alignment !== undefined,
				alignment: alignment ?? null,
				image: image ? { pos: image.pos, alt: image.node.attrs.alt as string, width: image.node.attrs.width as number | null } : null,
			};
		},
	});
	const [imageFormOpen, setImageFormOpen] = useState(false);

	function run(command: Command) {
		command(editor.state, editor.view.dispatch);
		editor.commands.focus();
	}

	return (
		<div className="markflow-editor-toolbar" role="toolbar" aria-label="Insert and table controls">
			<div role="group" aria-label="Insert">
				<button type="button" onClick={() => run(insertTable())} disabled={inTable}>
					Table
				</button>
				<button type="button" aria-expanded={imageFormOpen} onClick={() => setImageFormOpen((shown) => !shown)}>
					Image…
				</button>
			</div>

			{imageFormOpen ? <ImageInsertForm editor={editor} images={images} onDone={() => setImageFormOpen(false)} /> : null}

			{inTable ? (
				<>
					<div role="group" aria-label="Rows">
						<button type="button" onClick={() => run(addTableRow("before"))}>
							Row above
						</button>
						<button type="button" onClick={() => run(addTableRow("after"))}>
							Row below
						</button>
						<button type="button" onClick={() => run(deleteTableRow)}>
							Delete row
						</button>
					</div>
					<div role="group" aria-label="Columns">
						<button type="button" onClick={() => run(addTableColumn("before"))}>
							Column left
						</button>
						<button type="button" onClick={() => run(addTableColumn("after"))}>
							Column right
						</button>
						<button type="button" onClick={() => run(deleteTableColumn)}>
							Delete column
						</button>
					</div>
					<div role="group" aria-label="Column alignment">
						{ALIGNMENTS.map(({ value, label }) => (
							<button key={label} type="button" aria-pressed={alignment === value} onClick={() => run(setColumnAlignment(value))}>
								{label}
							</button>
						))}
					</div>
					<button type="button" onClick={() => run(deleteTable)}>
						Delete table
					</button>
				</>
			) : null}

			{/* Keyed by the alt text too, so an undo that changes it under an open
			    field remounts the controls with the new value. */}
			{image ? <ImageControls key={`${image.pos}:${image.alt}`} editor={editor} image={image} /> : null}
		</div>
	);
}

interface ImageInsertFormProps {
	editor: Editor;
	images: ImageInsertionContext;
	onDone(): void;
}

/** Insert by URL, stored exactly as typed, or by choosing a file. */
function ImageInsertForm({ editor, images, onDone }: ImageInsertFormProps) {
	const [url, setUrl] = useState("");

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		const target = url.trim();
		if (target !== "") {
			insertImages([{ src: target }])(editor.state, editor.view.dispatch);
		}
		onDone();
		editor.commands.focus();
	}

	async function chooseFile() {
		try {
			const selected = await open({
				multiple: false,
				filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
			});
			if (typeof selected === "string") {
				insertImageFiles(editor.view, [selected], undefined, images);
			}
		} catch (error) {
			images.notify(`Could not open the file dialog: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
		onDone();
		editor.commands.focus();
	}

	return (
		<form role="group" aria-label="Insert image" onSubmit={handleSubmit}>
			<button type="button" onClick={() => void chooseFile()}>
				Choose file…
			</button>
			<input
				autoFocus
				type="text"
				placeholder="or an image URL"
				aria-label="Image URL"
				value={url}
				onChange={(event) => setUrl(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						onDone();
					}
				}}
			/>
			<button type="submit">Insert</button>
		</form>
	);
}

interface ImageControlsProps {
	editor: Editor;
	image: { pos: number; alt: string; width: number | null };
}

/** Alt text and size of the selected image. Remounted by its key, see above. */
function ImageControls({ editor, image }: ImageControlsProps) {
	const [alt, setAlt] = useState(image.alt);

	function commitAlt() {
		if (alt !== image.alt) {
			setImageAlt(image.pos, alt)(editor.state, editor.view.dispatch);
		}
	}

	return (
		<div role="group" aria-label="Image">
			<label>
				Alt text{" "}
				<input
					type="text"
					aria-label="Alt text"
					value={alt}
					onChange={(event) => setAlt(event.target.value)}
					onBlur={commitAlt}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							commitAlt();
							editor.commands.focus();
						}
					}}
				/>
			</label>
			<span>{image.width === null ? "Original size" : `${image.width}px wide`}</span>
			{image.width !== null ? (
				<button type="button" onClick={() => setImageWidth(image.pos, null)(editor.state, editor.view.dispatch)}>
					Reset size
				</button>
			) : null}
		</div>
	);
}

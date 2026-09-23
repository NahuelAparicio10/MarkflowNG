import type { Editor } from "@tiptap/react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { getActiveLink, removeLink, setLink } from "../editor/links";

interface LinkEditorProps {
	editor: Editor;
	onClose(): void;
}

/**
 * The link affordance of design decision D4: creates a link from the
 * selection, or shows and changes the target of the link the caret is in.
 *
 * Reads the selection once, when opened, so the target being edited is fixed
 * for the lifetime of the popover even though focus has moved into it.
 */
export default function LinkEditor({ editor, onClose }: LinkEditorProps) {
	const [initial] = useState(() => {
		const { state, view } = editor;
		const active = getActiveLink(state);
		const coords = view.coordsAtPos(state.selection.from);

		return { href: active?.href ?? "", hasLink: active !== null, top: coords.bottom + 6, left: coords.left };
	});
	const [href, setHref] = useState(initial.href);

	function close() {
		onClose();
		editor.commands.focus();
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setLink(href)(editor.state, editor.view.dispatch);
		close();
	}

	function handleRemove() {
		removeLink(editor.state, editor.view.dispatch);
		close();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			close();
		}
	}

	return (
		<form
			className="markflow-link-editor"
			style={{ top: initial.top, left: initial.left }}
			onSubmit={handleSubmit}
			onKeyDown={handleKeyDown}
			aria-label="Edit link"
		>
			<input
				autoFocus
				// Not type="url": relative targets such as `./notes.md` are valid
				// Markdown links, and URL validation would refuse them.
				type="text"
				placeholder="https:// or ./relative.md"
				aria-label="Link target"
				value={href}
				onChange={(event) => setHref(event.target.value)}
			/>
			<button type="submit">{initial.hasLink ? "Update" : "Link"}</button>
			{initial.hasLink ? (
				<button type="button" onClick={handleRemove}>
					Remove
				</button>
			) : null}
		</form>
	);
}

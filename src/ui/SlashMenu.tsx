import { type Editor, useEditorState } from "@tiptap/react";
import { useLayoutEffect, useRef } from "react";
import { runSlashMenuItem, slashMenuKey } from "../editor/slashMenu";

interface SlashMenuProps {
	editor: Editor;
}

/** Space kept between the menu and the caret line, and between the menu and the viewport edge. */
const GAP = 6;

/**
 * Draws the slash menu the editor's slash menu plugin runs. Everything shown
 * comes from the plugin's state, so entries are whatever the registry holds —
 * nothing here names a command.
 *
 * The editor keeps focus throughout: keys reach the plugin, and a click on an
 * entry is kept from taking focus away.
 */
export default function SlashMenu({ editor }: SlashMenuProps) {
	const menu = useEditorState({
		editor,
		selector: ({ editor: current }) => slashMenuKey.getState(current.state) ?? null,
	});
	const listRef = useRef<HTMLDivElement>(null);

	const active = menu?.active === true;
	const from = menu?.from ?? 0;
	const query = menu?.query ?? "";

	// Placed below the caret line, or above it when there is no room below,
	// and kept inside the viewport horizontally. Re-measured as the filter
	// changes the menu's height. Written to the element directly: the position
	// depends on the menu's own measured size, which only exists after render.
	useLayoutEffect(() => {
		const list = listRef.current;
		if (!active || !list) {
			return;
		}

		const caret = editor.view.coordsAtPos(from);
		const { offsetHeight: height, offsetWidth: width } = list;
		const fitsBelow = caret.bottom + GAP + height <= window.innerHeight - GAP;
		const top = fitsBelow ? caret.bottom + GAP : Math.max(GAP, caret.top - GAP - height);
		const left = Math.max(GAP, Math.min(caret.left, window.innerWidth - GAP - width));

		list.style.top = `${top}px`;
		list.style.left = `${left}px`;
		list.style.visibility = "visible";
	}, [active, editor, from, query]);

	const selectedId = active ? menu.items[menu.selected]?.id : undefined;
	useLayoutEffect(() => {
		listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
	}, [selectedId]);

	if (!active) {
		return null;
	}

	const showGroups = new Set(menu.items.map((item) => item.group)).size > 1;

	return (
		<div
			ref={listRef}
			className="markflow-slash-menu"
			role="listbox"
			aria-label="Insert block"
			aria-busy={menu.pending}
			// Hidden until measured and placed, so no frame is drawn out of place.
			style={{ visibility: "hidden" }}
			onMouseDown={(event) => event.preventDefault()}
		>
			{menu.items.map((item, index) => {
				const startsGroup = showGroups && (index === 0 || menu.items[index - 1].group !== item.group);
				const selected = index === menu.selected;

				return (
					<div key={item.id} role="presentation">
						{startsGroup ? (
							<div className="markflow-slash-menu-group" role="presentation">
								{item.group}
							</div>
						) : null}
						<div
							role="option"
							aria-selected={selected}
							aria-disabled={menu.pending}
							className="markflow-slash-menu-item"
							onClick={() => void runSlashMenuItem(editor.view, index)}
						>
							{item.label}
							{selected && menu.pending ? <span className="markflow-slash-menu-pending"> …</span> : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}

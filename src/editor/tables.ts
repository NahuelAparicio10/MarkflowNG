import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import { type Command, type EditorState, Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import {
	addColumn,
	addRow,
	CellSelection,
	goToNextCell,
	isInTable,
	removeColumn,
	removeRow,
	selectedRect,
	TableMap,
	type TableRect,
} from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { TableAlignment } from "../core/schema";

/**
 * Table commands in plain ProseMirror form, like `commands.ts`.
 *
 * Row and column operations come from `prosemirror-tables` (design decision
 * D1), wrapped for the three rules that library does not know about:
 *
 * - alignment lives on the table as one entry per column (D3), so adding or
 *   removing a column has to add or remove its entry too;
 * - the first row is always the header (D4), so nothing inserts a row above
 *   it or deletes it;
 * - removing the last body row or the last column removes the table, rather
 *   than leaving a structure GFM cannot write.
 *
 * Merging and splitting cells are deliberately absent (D2).
 */

/** New tables get a header row and this many body rows and columns. */
export const NEW_TABLE_BODY_ROWS = 2;
export const NEW_TABLE_COLUMNS = 3;

function createTable(schema: Schema, bodyRows: number, columns: number): PmNode {
	const row = (cellType: "tableHeader" | "tableCell") =>
		schema.node("tableRow", null, Array.from({ length: columns }, () => schema.node(cellType)));

	return schema.node("table", { align: Array.from({ length: columns }, () => null) }, [
		row("tableHeader"),
		...Array.from({ length: bodyRows }, () => row("tableCell")),
	]);
}

/**
 * Inserts an empty table after the block holding the caret, or in its place
 * when that block is an empty paragraph, and puts the caret in the first
 * header cell. Declines inside a table, since GFM has no nested tables.
 */
export function insertTable(bodyRows = NEW_TABLE_BODY_ROWS, columns = NEW_TABLE_COLUMNS): Command {
	return (state, dispatch) => {
		if (isInTable(state)) {
			return false;
		}

		const { $from } = state.selection;
		if ($from.depth === 0) {
			return false;
		}

		const table = createTable(state.schema, bodyRows, columns);
		const block = $from.node(1);
		const tr = state.tr;
		let tablePos: number;

		if (block.type.name === "paragraph" && block.content.size === 0) {
			tablePos = $from.before(1);
			tr.replaceWith(tablePos, $from.after(1), table);
		} else {
			tablePos = $from.after(1);
			tr.insert(tablePos, table);
		}

		// Table, row, then the first cell's content.
		dispatch?.(tr.setSelection(TextSelection.create(tr.doc, tablePos + 3)).scrollIntoView());
		return true;
	};
}

function withAlignment(tr: Transaction, rect: TableRect, update: (align: TableAlignment[]) => TableAlignment[]) {
	const tablePos = rect.tableStart - 1;
	const table = tr.doc.nodeAt(tablePos);
	if (!table) {
		return;
	}

	tr.setNodeMarkup(tablePos, null, { ...table.attrs, align: update([...(table.attrs.align as TableAlignment[])]) });
}

/** A fresh rect for the table after `tr`'s changes so far. */
function refreshedRect(tr: Transaction, rect: TableRect): TableRect {
	const table = tr.doc.nodeAt(rect.tableStart - 1) as PmNode;

	return { ...rect, table, map: TableMap.get(table) };
}

function deleteTableAt(state: EditorState, rect: TableRect, dispatch?: (tr: Transaction) => void): boolean {
	if (dispatch) {
		const tablePos = rect.tableStart - 1;
		const tr = state.tr.delete(tablePos, tablePos + rect.table.nodeSize);
		const $pos = tr.doc.resolve(Math.min(tablePos, tr.doc.content.size));
		dispatch(tr.setSelection(TextSelection.near($pos)).scrollIntoView());
	}

	return true;
}

export const deleteTable: Command = (state, dispatch) => {
	if (!isInTable(state)) {
		return false;
	}

	return deleteTableAt(state, selectedRect(state), dispatch);
};

/** Adds a body row above or below the selection; never above the header. */
export function addTableRow(side: "before" | "after"): Command {
	return (state, dispatch) => {
		if (!isInTable(state)) {
			return false;
		}

		const rect = selectedRect(state);
		const index = side === "before" ? rect.top : rect.bottom;
		if (index === 0) {
			return false;
		}

		dispatch?.(addRow(state.tr, rect, index));
		return true;
	};
}

/**
 * Deletes the selected rows. The header row cannot be deleted; deleting every
 * body row deletes the table.
 */
export const deleteTableRow: Command = (state, dispatch) => {
	if (!isInTable(state)) {
		return false;
	}

	const rect = selectedRect(state);
	if (rect.top === 0) {
		return false;
	}
	if (rect.top === 1 && rect.bottom === rect.map.height) {
		return deleteTableAt(state, rect, dispatch);
	}

	if (dispatch) {
		const tr = state.tr;
		for (let row = rect.bottom - 1; row >= rect.top; row--) {
			removeRow(tr, refreshedRect(tr, rect), row);
		}
		dispatch(tr);
	}

	return true;
};

/** Adds a column left or right of the selection, unaligned. */
export function addTableColumn(side: "before" | "after"): Command {
	return (state, dispatch) => {
		if (!isInTable(state)) {
			return false;
		}

		if (dispatch) {
			const rect = selectedRect(state);
			const index = side === "before" ? rect.left : rect.right;
			const tr = addColumn(state.tr, rect, index);
			withAlignment(tr, rect, (align) => {
				align.splice(index, 0, null);
				return align;
			});
			dispatch(tr);
		}

		return true;
	};
}

/** Deletes the selected columns; deleting every column deletes the table. */
export const deleteTableColumn: Command = (state, dispatch) => {
	if (!isInTable(state)) {
		return false;
	}

	const rect = selectedRect(state);
	if (rect.left === 0 && rect.right === rect.map.width) {
		return deleteTableAt(state, rect, dispatch);
	}

	if (dispatch) {
		const tr = state.tr;
		for (let column = rect.right - 1; column >= rect.left; column--) {
			removeColumn(tr, refreshedRect(tr, rect), column);
		}
		withAlignment(tr, rect, (align) => {
			align.splice(rect.left, rect.right - rect.left);
			return align;
		});
		dispatch(tr);
	}

	return true;
};

/** Sets the alignment of every selected column. `null` is the default. */
export function setColumnAlignment(alignment: TableAlignment): Command {
	return (state, dispatch) => {
		if (!isInTable(state)) {
			return false;
		}

		if (dispatch) {
			const rect = selectedRect(state);
			const tr = state.tr;
			withAlignment(tr, rect, (align) => {
				for (let column = rect.left; column < rect.right; column++) {
					align[column] = alignment;
				}
				return align;
			});
			dispatch(tr);
		}

		return true;
	};
}

/** The alignment of the column holding the selection, or `undefined` outside a table. */
export function activeColumnAlignment(state: EditorState): TableAlignment | undefined {
	if (!isInTable(state)) {
		return undefined;
	}

	const rect = selectedRect(state);

	return (rect.table.attrs.align as TableAlignment[])[rect.left] ?? null;
}

/**
 * Tab moves to the next cell, and from the last cell adds a body row and
 * moves into it — the spreadsheet convention. Shift-Tab moves back and stops
 * at the first cell. Both are handled whenever the caret is in a table, so
 * Tab never moves focus out of the editor from inside one.
 */
export function moveToCell(direction: 1 | -1): Command {
	return (state, dispatch) => {
		if (!isInTable(state)) {
			return false;
		}

		if (goToNextCell(direction)(state, dispatch)) {
			return true;
		}

		if (direction === 1 && dispatch) {
			const rect = selectedRect(state);
			const tr = addRow(state.tr, rect, rect.map.height);
			const table = tr.doc.nodeAt(rect.tableStart - 1) as PmNode;
			// The new row is the table's last child; its first cell's content
			// starts two positions in.
			const rowStart = rect.tableStart + table.content.size - table.lastChild!.nodeSize;
			dispatch(tr.setSelection(TextSelection.create(tr.doc, rowStart + 2)).scrollIntoView());
		}

		return true;
	};
}

/**
 * Enter in a cell moves down a row in the same column, adding a body row from
 * the last one. A GFM cell holds a single line, so Enter cannot mean a new
 * paragraph there, and letting ProseMirror split the cell would add a column
 * to one row.
 */
export const enterInTable: Command = (state, dispatch) => {
	if (!isInTable(state)) {
		return false;
	}

	if (state.selection instanceof CellSelection) {
		return true;
	}

	if (dispatch) {
		const rect = selectedRect(state);
		const tr = state.tr;
		let map = rect.map;
		let table = rect.table;

		if (rect.bottom === map.height) {
			addRow(tr, rect, map.height);
			table = tr.doc.nodeAt(rect.tableStart - 1) as PmNode;
			map = TableMap.get(table);
		}

		const cellPos = map.positionAt(rect.bottom, rect.left, table);
		dispatch(tr.setSelection(TextSelection.create(tr.doc, rect.tableStart + cellPos + 1)).scrollIntoView());
	}

	return true;
};

const normalizeKey = new PluginKey("markflowTableNormalize");

/**
 * Keeps every table in the shape the mapping expects, whatever produced it —
 * a command, a paste, undo, or `prosemirror-tables`' own repairs: the first
 * row holds header cells and every other row body cells (D4), and the
 * alignment array has exactly one entry per column (D3).
 */
export function createTableNormalizePlugin(): Plugin {
	return new Plugin({
		key: normalizeKey,
		appendTransaction(transactions, _oldState, state) {
			if (!transactions.some((tr) => tr.docChanged)) {
				return null;
			}

			const { tableHeader, tableCell } = state.schema.nodes;
			let tr: Transaction | null = null;

			state.doc.descendants((node, pos) => {
				if (node.type.name !== "table") {
					return true;
				}

				const width = TableMap.get(node).width;
				const align = node.attrs.align as TableAlignment[];
				if (align.length !== width) {
					const fixed = Array.from({ length: width }, (_, column) => align[column] ?? null);
					tr ??= state.tr;
					tr.setNodeMarkup(pos, null, { ...node.attrs, align: fixed });
				}

				node.forEach((row, rowOffset, rowIndex) => {
					const wanted = rowIndex === 0 ? tableHeader : tableCell;
					row.forEach((cell, cellOffset) => {
						if (cell.type !== wanted) {
							tr ??= state.tr;
							tr.setNodeMarkup(pos + 1 + rowOffset + 1 + cellOffset, wanted, cell.attrs);
						}
					});
				});

				return false;
			});

			return tr;
		},
	});
}

/**
 * Projects each table's column alignment onto its cells for display (D3):
 * the alignment is stored once on the table and drawn on every cell.
 */
export function createTableAlignmentPlugin(): Plugin {
	function decorate(doc: PmNode): DecorationSet {
		const decorations: Decoration[] = [];

		doc.descendants((node, pos) => {
			if (node.type.name !== "table") {
				return true;
			}

			const align = node.attrs.align as TableAlignment[];
			node.forEach((row, rowOffset) => {
				row.forEach((cell, cellOffset, column) => {
					const alignment = align[column];
					if (alignment) {
						const from = pos + 1 + rowOffset + 1 + cellOffset;
						decorations.push(Decoration.node(from, from + cell.nodeSize, { style: `text-align: ${alignment}` }));
					}
				});
			});

			return false;
		});

		return DecorationSet.create(doc, decorations);
	}

	return new Plugin({
		state: {
			init: (_config, state) => decorate(state.doc),
			apply: (tr, previous) => (tr.docChanged ? decorate(tr.doc) : previous),
		},
		props: {
			decorations(state) {
				return this.getState(state);
			},
		},
	});
}

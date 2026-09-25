import type { Node as PmNode } from "@tiptap/pm/model";
import type { AlignType, PhrasingContent, Table, TableCell, TableRow } from "mdast";
import type { TableAlignment } from "../../schema";
import { defineNodeHandler } from "../registry";
import type { MdastToPmContext } from "../types";
import { type HandlerLookup, phrasingToMdast } from "./phrasing";

/**
 * The table handler pairs.
 *
 * mdast and `prosemirror-tables` disagree about shape in three ways, and each
 * is settled here rather than in the walkers:
 *
 * - mdast has one cell type and makes the first row the header by position;
 *   ProseMirror has distinct header and body cell types. The table handler
 *   builds the first row from header cells and every other row from body
 *   cells, and both cell types convert back to an mdast `tableCell`.
 * - mdast admits ragged rows; a ProseMirror table must be rectangular. Rows
 *   are padded with empty cells to the widest row on load, and the alignment
 *   array is padded with `null` to match. The serializer pads ragged rows the
 *   same way on its own, so this adds no change a save would not make anyway.
 * - Alignment is one array on the table in both models (design decision D3),
 *   so it maps across directly.
 *
 * Rows and cells only ever occur inside a table, so their forward handlers are
 * reached through the table handler rather than through dispatch. They are
 * still registered as pairs, so the backward direction dispatches through
 * the registry like every other node type, and a row or cell converted on its
 * own behaves sensibly.
 */

type CellType = "tableHeader" | "tableCell";

function cellToPm(cell: TableCell, type: CellType, { schema, convertChildren }: MdastToPmContext): PmNode {
	return schema.node(type, null, convertChildren(cell, true));
}

function rowToPm(row: TableRow, type: CellType, width: number, context: MdastToPmContext): PmNode {
	const cells = row.children.map((cell) => cellToPm(cell, type, context));

	// Ragged-row normalization: see the module comment.
	while (cells.length < width) {
		cells.push(context.schema.node(type));
	}

	return context.schema.node("tableRow", null, cells);
}

/** The widest row, which every row is padded to. */
function tableWidth(node: Table): number {
	return node.children.reduce((width, row) => Math.max(width, row.children.length), 0);
}

function alignmentToPm(align: Table["align"], width: number): TableAlignment[] {
	const result: TableAlignment[] = [];

	for (let column = 0; column < width; column++) {
		result.push(align?.[column] ?? null);
	}

	return result;
}

export const tableHandler = defineNodeHandler<Table>({
	mdastType: "table",
	pmType: "table",

	toPm(node, context) {
		const width = tableWidth(node);

		// A table with no cells at all cannot come from GFM, which requires a
		// header, and has no valid ProseMirror form. Dropping it loses nothing
		// that could be written back.
		if (width === 0) {
			return [];
		}

		const rows = node.children.map((row, index) =>
			rowToPm(row, index === 0 ? "tableHeader" : "tableCell", width, context),
		);

		return [context.schema.node("table", { align: alignmentToPm(node.align, width) }, rows)];
	},

	toMdast(node, { convertChildren }) {
		return [
			{
				type: "table",
				align: [...(node.attrs.align as AlignType[])],
				children: convertChildren(node) as TableRow[],
			},
		];
	},
});

export const tableRowHandler = defineNodeHandler<TableRow>({
	mdastType: "tableRow",
	pmType: "tableRow",

	toPm(node, context) {
		return [rowToPm(node, "tableCell", node.children.length, context)];
	},

	toMdast(node, { convertChildren }) {
		return [{ type: "tableRow", children: convertChildren(node) as TableCell[] }];
	},
});

/** Cells hold phrasing content, so they need the mark handlers, like paragraphs. */
export function createTableCellHandler(lookup: HandlerLookup) {
	return defineNodeHandler<TableCell>({
		mdastType: "tableCell",
		pmType: "tableCell",

		toPm(node, context) {
			return [cellToPm(node, "tableCell", context)];
		},

		toMdast(node, context) {
			return [{ type: "tableCell", children: phrasingToMdast(node, context, lookup) as PhrasingContent[] }];
		},
	});
}

/**
 * mdast has no header cell type — a header cell is a `tableCell` in the first
 * row — so this pair is keyed by a type name remark never produces. Forward
 * dispatch therefore never reaches it; header cells are built by the table
 * handler, which knows the row index. The backward direction is the one that
 * matters, and it yields an ordinary `tableCell`.
 */
export const TABLE_HEADER_MDAST_KEY = "tableHeaderCell";

export function createTableHeaderHandler(lookup: HandlerLookup) {
	return defineNodeHandler<TableCell>({
		mdastType: TABLE_HEADER_MDAST_KEY as TableCell["type"],
		pmType: "tableHeader",

		toPm(node, context) {
			return [cellToPm(node, "tableHeader", context)];
		},

		toMdast(node, context) {
			return [{ type: "tableCell", children: phrasingToMdast(node, context, lookup) as PhrasingContent[] }];
		},
	});
}

import type { Node as PmNode } from "@tiptap/pm/model";
import { type Command, TextSelection } from "@tiptap/pm/state";
import { CellSelection, tableEditing } from "@tiptap/pm/tables";
import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createExtensions } from "../extensions";
import {
	addTableColumn,
	addTableRow,
	createTableNormalizePlugin,
	deleteTable,
	deleteTableColumn,
	deleteTableRow,
	enterInTable,
	insertTable,
	moveToCell,
	setColumnAlignment,
} from "../tables";
import { createTestView, docFrom, markdownOf, positionAfter, type TestView } from "./harness";

const TABLE = "| Stat | Base | Bonus |\n| ---- | ---- | ----- |\n| HP   | 100  | 5     |\n| MP   | 40   | 2     |\n";

function viewAt(markdown: string, text: string): TestView {
	const doc = docFrom(markdown);
	return createTestView(doc, [tableEditing(), createTableNormalizePlugin()], positionAfter(doc, text));
}

function table(view: TestView): PmNode {
	let found: PmNode | null = null;
	view.state.doc.descendants((node) => {
		if (!found && node.type.name === "table") {
			found = node;
		}
		return found === null;
	});
	if (!found) {
		throw new Error("No table in document");
	}
	return found;
}

function hasTable(view: TestView): boolean {
	let found = false;
	view.state.doc.descendants((node) => {
		found ||= node.type.name === "table";
		return !found;
	});
	return found;
}

function cellTexts(view: TestView): string[][] {
	const rows: string[][] = [];
	table(view).forEach((row) => {
		const cells: string[] = [];
		row.forEach((cell) => cells.push(cell.textContent));
		rows.push(cells);
	});
	return rows;
}

function run(view: TestView, command: Command): boolean {
	return command(view.state, (tr) => view.dispatch(tr));
}

/** Markdown after a save and a fresh load, which must be a fixed point. */
function roundTrips(view: TestView): void {
	const saved = markdownOf(view);
	const reloaded = createTestView(docFrom(saved));

	expect(markdownOf(reloaded)).toBe(saved);
}

describe("inserting a table", () => {
	it("creates a header row and at least one body row, and round-trips", () => {
		const doc = docFrom("Intro\n");
		const view = createTestView(doc, [], positionAfter(doc, "Intro"));

		expect(run(view, insertTable())).toBe(true);

		const rows = table(view);
		expect(rows.childCount).toBeGreaterThanOrEqual(2);
		rows.child(0).forEach((cell) => expect(cell.type.name).toBe("tableHeader"));
		rows.child(1).forEach((cell) => expect(cell.type.name).toBe("tableCell"));
		expect(view.state.selection.$from.parent.type.name).toBe("tableHeader");
		roundTrips(view);
	});

	it("replaces an empty paragraph rather than leaving it above the table", () => {
		const view = createTestView(docFrom(""), [], 1);

		run(view, insertTable());

		expect(view.state.doc.firstChild?.type.name).toBe("table");
	});

	it("declines inside a table, since GFM cannot nest one", () => {
		expect(run(viewAt(TABLE, "HP"), insertTable())).toBe(false);
	});
});

describe("rows", () => {
	it("adds a row with as many cells as the table has columns", () => {
		const view = viewAt(TABLE, "HP");

		run(view, addTableRow("after"));

		expect(cellTexts(view)).toEqual([
			["Stat", "Base", "Bonus"],
			["HP", "100", "5"],
			["", "", ""],
			["MP", "40", "2"],
		]);
		roundTrips(view);
	});

	it("never adds a row above the header", () => {
		expect(run(viewAt(TABLE, "Stat"), addTableRow("before"))).toBe(false);
	});

	it("never deletes the header row", () => {
		expect(run(viewAt(TABLE, "Stat"), deleteTableRow)).toBe(false);
	});

	it("deletes a body row", () => {
		const view = viewAt(TABLE, "HP");

		run(view, deleteTableRow);

		expect(cellTexts(view)).toEqual([
			["Stat", "Base", "Bonus"],
			["MP", "40", "2"],
		]);
		roundTrips(view);
	});

	it("removes the table when its last body row is deleted", () => {
		const view = viewAt("Before\n\n| a |\n| - |\n| 1 |\n\nAfter\n", "1");

		run(view, deleteTableRow);

		expect(hasTable(view)).toBe(false);
		expect(markdownOf(view)).toBe("Before\n\nAfter\n");
	});
});

describe("columns", () => {
	it("adds a cell to every row including the header, and an alignment entry", () => {
		const view = viewAt("| a | b |\n| -: | :- |\n| 1 | 2 |\n", "a");

		run(view, addTableColumn("after"));

		expect(cellTexts(view)).toEqual([
			["a", "", "b"],
			["1", "", "2"],
		]);
		expect(table(view).attrs.align).toEqual(["right", null, "left"]);
		expect(table(view).child(0).child(1).type.name).toBe("tableHeader");
		roundTrips(view);
	});

	it("deletes a column and its alignment entry", () => {
		const view = viewAt("| a | b |\n| -: | :- |\n| 1 | 2 |\n", "a");

		run(view, deleteTableColumn);

		expect(cellTexts(view)).toEqual([["b"], ["2"]]);
		expect(table(view).attrs.align).toEqual(["left"]);
		roundTrips(view);
	});

	it("removes the table when its only column is deleted", () => {
		const view = viewAt("Before\n\n| a |\n| - |\n| 1 |\n", "1");

		run(view, deleteTableColumn);

		expect(hasTable(view)).toBe(false);
		expect(markdownOf(view)).toBe("Before\n");
	});
});

describe("alignment", () => {
	it("sets the column's alignment on the table, which every cell in it follows", () => {
		const view = viewAt(TABLE, "100");

		run(view, setColumnAlignment("right"));

		expect(table(view).attrs.align).toEqual([null, "right", null]);
		expect(markdownOf(view)).toContain("| ---: |");
	});

	it("round-trips left, right, centre and default", () => {
		const view = viewAt(TABLE, "Stat");
		run(view, setColumnAlignment("left"));
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, positionAfter(view.state.doc, "Base"))));
		run(view, setColumnAlignment("center"));

		expect(table(view).attrs.align).toEqual(["left", "center", null]);
		roundTrips(view);
	});
});

describe("keyboard navigation", () => {
	it("moves to the next cell with Tab", () => {
		const view = viewAt(TABLE, "Stat");

		run(view, moveToCell(1));

		expect(view.state.selection.$from.parent.textContent).toBe("Base");
	});

	it("adds a row from the last cell and moves into it", () => {
		const view = viewAt(TABLE, "2");

		run(view, moveToCell(1));

		expect(cellTexts(view)).toHaveLength(4);
		expect(view.state.selection.$from.parent.textContent).toBe("");
		expect(view.state.selection.$from.parent.type.name).toBe("tableCell");
	});

	it("moves back with Shift-Tab and stays put in the first cell", () => {
		const view = viewAt(TABLE, "Stat");

		expect(run(view, moveToCell(-1))).toBe(true);
		expect(view.state.selection.$from.parent.textContent).toBe("Stat");
	});

	it("moves down a column with Enter instead of splitting the cell", () => {
		const view = viewAt(TABLE, "100");

		run(view, enterInTable);

		expect(view.state.selection.$from.parent.textContent).toBe("40");
		expect(cellTexts(view)[1]).toHaveLength(3);
	});
});

describe("the header row stays a header row", () => {
	it("converts cells that end up in the first row to header cells, and the rest to body cells", () => {
		const view = viewAt(TABLE, "HP");
		const { tableCell } = view.state.schema.nodes;
		// Force the header's first cell into a body cell, as a paste might.
		const headerCellPos = positionAfter(view.state.doc, "Stat") - "Stat".length - 1;
		view.dispatch(view.state.tr.setNodeMarkup(headerCellPos, tableCell));

		expect(table(view).child(0).child(0).type.name).toBe("tableHeader");
	});
});

describe("deleting a table", () => {
	it("removes the table and leaves a valid document", () => {
		const view = viewAt(TABLE, "HP");

		run(view, deleteTable);

		expect(hasTable(view)).toBe(false);
		expect(() => view.state.doc.check()).not.toThrow();
	});
});

describe("merging is unreachable", () => {
	it("offers no merge or split command in the editor", async () => {
		const tables = await import("../tables");

		expect(Object.keys(tables).filter((name) => /merge|split/i.test(name))).toEqual([]);
	});

	it("keeps cell spans at 1 when multiple cells are selected", () => {
		const view = viewAt(TABLE, "HP");
		const from = positionAfter(view.state.doc, "HP") - 3;
		const to = positionAfter(view.state.doc, "100") - 4;
		view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, from, to)));

		expect(view.state.selection).toBeInstanceOf(CellSelection);
		view.state.doc.descendants((node) => {
			if (node.type.spec.tableRole === "cell" || node.type.spec.tableRole === "header_cell") {
				expect(node.attrs.colspan).toBe(1);
				expect(node.attrs.rowspan).toBe(1);
			}
		});
	});
});

describe("column resizing is view state", () => {
	it("leaves the serialized document unchanged after a column is resized", () => {
		const view = viewAt(TABLE, "HP");
		const before = markdownOf(view);
		const tr = view.state.tr;
		// What prosemirror-tables' column resizing dispatches: a pixel width on
		// every cell of the dragged column.
		view.state.doc.descendants((node, pos) => {
			if (node.type.spec.tableRole === "cell" || node.type.spec.tableRole === "header_cell") {
				tr.setNodeMarkup(pos, null, { ...node.attrs, colwidth: [180] });
			}
		});
		view.dispatch(tr);

		expect(table(view).child(1).child(0).attrs.colwidth).toEqual([180]);
		expect(markdownOf(view)).toBe(before);
	});

	it("registers prosemirror-tables' column resizing in the editor", () => {
		const extensions = createExtensions({
			isInputRulesEnabled: () => true,
			onOpenLink: () => {},
			images: { getDocumentPath: () => null, getWorkspaceRoot: () => null, notify: () => {} },
		});
		const schema = getSchema(extensions);

		expect(schema.nodes.table.spec.tableRole).toBe("table");
		expect(schema.nodes.tableHeader.spec.tableRole).toBe("header_cell");
		expect(Object.keys(schema.nodes.tableCell.spec.attrs ?? {})).toContain("colwidth");
	});
});

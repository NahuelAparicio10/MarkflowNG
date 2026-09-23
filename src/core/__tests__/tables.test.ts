import type { Node as PmNode } from "@tiptap/pm/model";
import type { Table } from "mdast";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../fixtures/manifest";
import { mdastToPm, pmToMdast } from "../mapping";
import { parseMarkdown, serializeMarkdown } from "../markdown";
import { schema } from "../schema";
import { readFixture } from "./helpers";

function toPm(source: string): PmNode {
	return mdastToPm(parseMarkdown(source));
}

function firstTable(doc: PmNode): PmNode {
	let table: PmNode | null = null;
	doc.descendants((node) => {
		if (!table && node.type.name === "table") {
			table = node;
		}
		return table === null;
	});

	if (!table) {
		throw new Error("No table in document");
	}

	return table;
}

function cellTypes(table: PmNode): string[][] {
	const rows: string[][] = [];
	table.forEach((row) => {
		const cells: string[] = [];
		row.forEach((cell) => cells.push(cell.type.name));
		rows.push(cells);
	});
	return rows;
}

function cellTexts(table: PmNode): string[][] {
	const rows: string[][] = [];
	table.forEach((row) => {
		const cells: string[] = [];
		row.forEach((cell) => cells.push(cell.textContent));
		rows.push(cells);
	});
	return rows;
}

describe("table structure", () => {
	it("maps the first row to header cells and every other row to body cells", () => {
		const table = firstTable(toPm("| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |\n"));

		expect(cellTypes(table)).toEqual([
			["tableHeader", "tableHeader"],
			["tableCell", "tableCell"],
			["tableCell", "tableCell"],
		]);
	});

	it("keeps a header-only table as a single header row", () => {
		const table = firstTable(toPm("| a |\n| - |\n"));

		expect(cellTypes(table)).toEqual([["tableHeader"]]);
	});

	it("gives cells inline content directly, so a cell cannot hold block structure", () => {
		expect(schema.nodes.tableCell.isTextblock).toBe(true);
		expect(schema.nodes.tableHeader.isTextblock).toBe(true);
	});

	it("carries inline marks inside cells", () => {
		const table = firstTable(toPm("| **a** |\n| - |\n| [b](x.md) |\n"));
		const header = table.child(0).child(0).firstChild;
		const body = table.child(1).child(0).firstChild;

		expect(header?.marks.map((mark) => mark.type.name)).toEqual(["strong"]);
		expect(body?.marks.map((mark) => mark.type.name)).toEqual(["link"]);
	});
});

describe("column alignment", () => {
	it("is a per-column array on the table node", () => {
		const table = firstTable(toPm("| a | b | c | d |\n| :- | :-: | -: | - |\n| 1 | 2 | 3 | 4 |\n"));

		expect(table.attrs.align).toEqual(["left", "center", "right", null]);
	});

	it("is not an attribute of any cell", () => {
		for (const name of ["tableHeader", "tableCell"]) {
			expect(Object.keys(schema.nodes[name].spec.attrs ?? {})).not.toContain("align");
		}
	});

	it("round-trips every alignment", () => {
		const source = "| a  |  b  |  c | d |\n| :- | :-: | -: | - |\n| 1  |  2  |  3 | 4 |\n";

		expect(serializeMarkdown(pmToMdast(toPm(source)))).toBe(source);
	});

	it("rejects a value GFM cannot express", () => {
		const table = schema.node("table", { align: ["justify"] }, [
			schema.node("tableRow", null, [schema.node("tableHeader")]),
		]);

		expect(() => table.check()).toThrow(/alignment/);
	});
});

describe("merged cells are unreachable", () => {
	it.each(["colspan", "rowspan"])("rejects a cell with a %s greater than one", (attr) => {
		const cell = schema.node("tableCell", { [attr]: 2 });

		expect(() => cell.check()).toThrow(/Merged cells/);
	});

	it("rejects a merged cell arriving from serialized state", () => {
		expect(() => schema.nodeFromJSON({ type: "tableCell", attrs: { colspan: 2 } })).toThrow(/Merged cells/);
	});
});

describe("ragged rows", () => {
	const fixture = FIXTURES.find((candidate) => candidate.path === "tables/ragged-rows.md");

	it("is covered by a fixture that declares the normalization", () => {
		expect(fixture?.serializerNormalizes).toBeTruthy();
	});

	it("pads short rows with empty cells on load, so the table is rectangular", () => {
		const table = firstTable(toPm(readFixture(fixture!)));

		expect(cellTexts(table)).toEqual([
			["Name", "Cost", "Weight"],
			["Potion", "10", ""],
			["Elixir", "", ""],
			["Bomb", "25", "2"],
		]);
		expect(() => table.check()).not.toThrow();
	});

	it("widens the header and the alignment for a row longer than the header", () => {
		const table = firstTable(toPm("| a |\n| :- |\n| 1 | 2 |\n"));

		expect(cellTexts(table)).toEqual([
			["a", ""],
			["1", "2"],
		]);
		expect(table.attrs.align).toEqual(["left", null]);
	});

	it("serializes the padded table as remark would serialize the ragged one", () => {
		const source = readFixture(fixture!);

		expect(serializeMarkdown(pmToMdast(toPm(source)))).toBe(serializeMarkdown(parseMarkdown(source)));
	});
});

describe("column widths are view state", () => {
	it("leaves the serialized Markdown unchanged when columns carry a resized width", () => {
		const source = "| Stat | Value |\n| ---- | ----- |\n| HP   | 100   |\n";
		const doc = toPm(source);
		const json = doc.toJSON() as { content: { content: { content: { attrs: Record<string, unknown> }[] }[] }[] };

		// What column resizing writes: a pixel width on every cell of a column.
		for (const row of json.content[0].content) {
			row.content[0].attrs.colwidth = [240];
		}
		const resized = schema.nodeFromJSON(json);

		expect(firstTable(resized).child(0).child(0).attrs.colwidth).toEqual([240]);
		expect(serializeMarkdown(pmToMdast(resized))).toBe(source);
	});

	it("writes no width information into mdast", () => {
		const doc = toPm("| a |\n| - |\n");
		const table = pmToMdast(doc).children[0] as Table;

		expect(JSON.stringify(table)).not.toMatch(/width/i);
	});
});

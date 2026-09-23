import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { schema as coreSchema } from "../../core/schema";
import { extensions } from "../extensions";

describe("editor extensions", () => {
	it("build a schema with exactly the core node types, and no others", () => {
		const editorSchema = getSchema(extensions);

		expect(Object.keys(editorSchema.nodes).sort()).toEqual(Object.keys(coreSchema.nodes).sort());
	});

	it("matches the core schema's content expression and group for every node", () => {
		const editorSchema = getSchema(extensions);

		for (const [name, coreType] of Object.entries(coreSchema.nodes)) {
			const editorType = editorSchema.nodes[name];
			expect(editorType, `missing node type: ${name}`).toBeDefined();
			expect(editorType.spec.content ?? "").toBe(coreType.spec.content ?? "");
			expect(editorType.spec.group ?? "").toBe(coreType.spec.group ?? "");
		}
	});

	it("marks preserved and preservedInline as atoms, matching the core schema", () => {
		const editorSchema = getSchema(extensions);

		expect(editorSchema.nodes.preserved.isAtom).toBe(true);
		expect(editorSchema.nodes.preservedInline.isAtom).toBe(true);
		expect(editorSchema.nodes.preservedInline.isInline).toBe(true);
	});

	it("registers no StarterKit node or mark extension", () => {
		// D1: StarterKit is kept only for its non-schema extensions. None of
		// its own nodes contribute to the schema.
		const editorSchema = getSchema(extensions);

		expect(editorSchema.marks).toEqual({});
	});
});

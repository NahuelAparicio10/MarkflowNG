import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { schema as coreSchema } from "../../core/schema";
import { createExtensions } from "../extensions";

const extensions = createExtensions({ isInputRulesEnabled: () => true, onOpenLink: () => {} });

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
			expect(editorType.spec.marks, `marks of ${name}`).toBe(coreType.spec.marks);
			expect(Boolean(editorType.spec.code), `code flag of ${name}`).toBe(Boolean(coreType.spec.code));
		}
	});

	it("marks preserved and preservedInline as atoms, matching the core schema", () => {
		const editorSchema = getSchema(extensions);

		expect(editorSchema.nodes.preserved.isAtom).toBe(true);
		expect(editorSchema.nodes.preservedInline.isAtom).toBe(true);
		expect(editorSchema.nodes.preservedInline.isInline).toBe(true);
	});

	it("builds exactly the core marks, in the same rank order", () => {
		// D1: StarterKit is kept only for its non-schema extensions, so every
		// mark comes from the core schema. Rank order decides how co-extensive
		// marks nest when converted back to mdast, so it must match too.
		const editorSchema = getSchema(extensions);

		expect(Object.keys(editorSchema.marks)).toEqual(Object.keys(coreSchema.marks));
	});

	it("keeps each mark's inclusivity and code flag from the core schema", () => {
		const editorSchema = getSchema(extensions);

		for (const [name, coreType] of Object.entries(coreSchema.marks)) {
			const editorType = editorSchema.marks[name];
			expect(editorType.spec.inclusive, `inclusive of ${name}`).toBe(coreType.spec.inclusive);
			expect(Boolean(editorType.spec.code), `code flag of ${name}`).toBe(Boolean(coreType.spec.code));
			expect(Object.keys(editorType.spec.attrs ?? {})).toEqual(Object.keys(coreType.spec.attrs ?? {}));
		}
	});
});

import { describe, expect, it } from "vitest";
import { mdastToPm } from "../../core/mapping";
import { parseMarkdown } from "../../core/markdown";
import { isDirty } from "../dirty";
import { serializeDoc } from "../documentText";

describe("isDirty", () => {
	it("is false when the current text matches the baseline", () => {
		expect(isDirty("# Title\n", "# Title\n")).toBe(false);
	});

	it("is true when the current text differs from the baseline", () => {
		expect(isDirty("# Title!\n", "# Title\n")).toBe(true);
	});
});

describe("dirty detection over a document", () => {
	it("an unedited document is never dirty, even in non-normal form", () => {
		// "non-normal form" edge fixture content: valid but not how the
		// serializer would write it. The baseline must be taken from the
		// freshly loaded document's own serialization, not the raw source,
		// or an untouched document would appear dirty on open.
		const source = "*   loose  bullets\n*   with odd spacing\n";
		const doc = mdastToPm(parseMarkdown(source));
		const baseline = serializeDoc(doc);

		expect(isDirty(serializeDoc(doc), baseline)).toBe(false);
	});

	it("an edit marks the document dirty, and reverting it clears dirty again", () => {
		const original = mdastToPm(parseMarkdown("# Title\n\nBody.\n"));
		const baseline = serializeDoc(original);

		const editedJson = original.toJSON();
		editedJson.content[1].content[0].text = "Body edited.";
		const edited = original.type.schema.nodeFromJSON(editedJson);
		expect(isDirty(serializeDoc(edited), baseline)).toBe(true);

		const revertedJson = edited.toJSON();
		revertedJson.content[1].content[0].text = "Body.";
		const reverted = original.type.schema.nodeFromJSON(revertedJson);
		expect(isDirty(serializeDoc(reverted), baseline)).toBe(false);
	});
});

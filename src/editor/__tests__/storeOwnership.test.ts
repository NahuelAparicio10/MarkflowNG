import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const editorViewSource = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "..", "EditorView.tsx"),
	"utf8",
);

describe("session store ownership of editable content", () => {
	// The whole point of design decision D4: no transaction handler may write
	// document content into the session store, only the derived boolean
	// dirty flag. Inspecting the source is what the spec's "No per-transaction
	// synchronization" scenario asks for, mirroring purity.test.ts.
	it("EditorView's update handler only calls setDirty, never a store setter that takes document content", () => {
		const updateHandlerMatch = editorViewSource.match(
			/function handleUpdate\(\) \{[\s\S]*?\n\t\t\}/,
		);
		expect(updateHandlerMatch, "handleUpdate not found in EditorView.tsx").not.toBeNull();

		const body = updateHandlerMatch![0];

		expect(body).toContain("setDirty(");
		expect(body).not.toMatch(/setState|openDocument|setTree/);
	});

	it("EditorView never imports the store's openDocument/tree-writing helpers by another name", () => {
		expect(editorViewSource).not.toMatch(/state\.tree\s*=/);
	});
});

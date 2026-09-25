import type { Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasEditorFsHatchFile, installEditorFsHatch } from "../fs";
import { createImageInsertionPlugin, type ImageInsertionContext, insertImageFiles } from "../imageInsertion";
import { insertImages, selectedImage, setImageAlt, setImageWidth } from "../images";
import { createTestView, docFrom, markdownOf, positionAfter, type TestView } from "./harness";

const DOCUMENT = "/workspace/docs/guide.md";

function context(overrides: Partial<ImageInsertionContext> = {}): ImageInsertionContext {
	return {
		getDocumentPath: () => DOCUMENT,
		getWorkspaceRoot: () => "/workspace",
		notify: vi.fn(),
		...overrides,
	};
}

function imagePos(doc: PmNode): number {
	let found = -1;
	doc.descendants((node, pos) => {
		if (found < 0 && node.type.name === "image") {
			found = pos;
		}
		return found < 0;
	});
	return found;
}

function pasteEvent(files: File[]): ClipboardEvent {
	return { clipboardData: { files }, preventDefault: vi.fn() } as unknown as ClipboardEvent;
}

/** Lets the asynchronous write and insertion settle. */
async function settle(): Promise<void> {
	for (let i = 0; i < 5; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

beforeEach(() => {
	installEditorFsHatch({ [DOCUMENT]: "# Guide\n" });
});

describe("inserting an image", () => {
	it("inserts at the caret", () => {
		const doc = docFrom("Before after\n");
		const view = createTestView(doc, [], positionAfter(doc, "Before "));

		insertImages([{ src: "assets/a.png", alt: "A" }])(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("Before ![A](assets/a.png)after\n");
	});

	it("stores an absolute URL exactly as given", () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], positionAfter(doc, "x"));
		const url = "https://example.com/render?id=42&size=large";

		insertImages([{ src: url }])(view.state, view.dispatch);

		expect(view.state.doc.nodeAt(imagePos(view.state.doc))?.attrs.src).toBe(url);
	});

	it("puts an image inserted inside a code block into a paragraph after it", () => {
		const doc = docFrom("```\ncode\n```\n");
		const view = createTestView(doc, [], positionAfter(doc, "code"));

		insertImages([{ src: "a.png" }])(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("```\ncode\n```\n\n![](a.png)\n");
	});

	it("inserts a file from the dialog or an OS drop relative to the document when inside the workspace", () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], positionAfter(doc, "x"));

		insertImageFiles(view as unknown as EditorView, ["/workspace/images/map.png"], undefined, context());

		expect(markdownOf(view)).toBe("x![map](../images/map.png)\n");
	});

	it("inserts at a drop position", () => {
		const doc = docFrom("one two\n");
		const view = createTestView(doc, [], 1);

		insertImageFiles(view as unknown as EditorView, ["/workspace/docs/a.png"], positionAfter(doc, "one "), context());

		expect(markdownOf(view)).toBe("one ![a](a.png)two\n");
	});

	it("ignores dropped files that are not images", () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], 1);

		expect(insertImageFiles(view as unknown as EditorView, ["/workspace/notes.txt"], undefined, context())).toBe(false);
	});
});

describe("pasting image data", () => {
	async function paste(view: TestView, files: File[], ctx: ImageInsertionContext): Promise<boolean> {
		const plugin = createImageInsertionPlugin(ctx);
		const handled = plugin.props.handlePaste?.call(plugin, view as unknown as EditorView, pasteEvent(files), undefined as never);
		await settle();
		return handled === true;
	}

	it("writes the data into the assets directory and references it", async () => {
		const doc = docFrom("Shot: \n");
		const view = createTestView(doc, [], positionAfter(doc, "Shot:"));
		const ctx = context();

		expect(await paste(view, [new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" })], ctx)).toBe(true);

		const output = markdownOf(view);
		const reference = /\]\((assets\/image-\d{8}-\d{6}\.png)\)/.exec(output)?.[1];
		expect(reference).toBeDefined();
		expect(hasEditorFsHatchFile(`/workspace/docs/${reference}`)).toBe(true);
	});

	it("never embeds the data inline", async () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], 1);

		await paste(view, [new File([new Uint8Array([1])], "", { type: "image/png" })], context());

		expect(markdownOf(view)).not.toMatch(/data:/);
	});

	it("tells the user where the file was written", async () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], 1);
		const ctx = context();

		await paste(view, [new File([new Uint8Array([1])], "", { type: "image/png" })], ctx);

		expect(ctx.notify).toHaveBeenCalledWith(expect.stringMatching(/^Image saved to \/workspace\/docs\/assets\/image-/), "info");
	});

	it("leaves a paste with no image to the default handling", async () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], 1);

		expect(await paste(view, [], context())).toBe(false);
	});

	it("reports, rather than inserting, when the document has no path yet", async () => {
		const doc = docFrom("x\n");
		const view = createTestView(doc, [], 1);
		const ctx = context({ getDocumentPath: () => null });

		await paste(view, [new File([new Uint8Array([1])], "", { type: "image/png" })], ctx);

		expect(markdownOf(view)).toBe("x\n");
		expect(ctx.notify).toHaveBeenCalledWith(expect.any(String), "error");
	});
});

describe("editing an image", () => {
	function selectedImageView(markdown: string): TestView {
		const doc = docFrom(markdown);
		const view = createTestView(doc);
		view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, imagePos(view.state.doc))));
		return view;
	}

	it("stores edited alt text", () => {
		const view = selectedImageView("![old](a.png)\n");

		setImageAlt(selectedImage(view.state)!.pos, "A clear description")(view.state, view.dispatch);

		expect(markdownOf(view)).toBe("![A clear description](a.png)\n");
	});

	it("persists a resize in the title and clears it again on reset", () => {
		const view = selectedImageView('![a](a.png "Caption")\n');
		const pos = selectedImage(view.state)!.pos;

		setImageWidth(pos, 319.6)(view.state, view.dispatch);
		expect(markdownOf(view)).toBe('![a](a.png "Caption | width=320")\n');

		setImageWidth(pos, null)(view.state, view.dispatch);
		expect(markdownOf(view)).toBe('![a](a.png "Caption")\n');
	});

	it("keeps the image selected after a change, so its controls stay open", () => {
		const view = selectedImageView("![a](a.png)\n");

		setImageAlt(selectedImage(view.state)!.pos, "b")(view.state, view.dispatch);

		expect(selectedImage(view.state)).not.toBeNull();
	});
});

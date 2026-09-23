import { describe, expect, it } from "vitest";
import { isExternalReference, referenceFor, relativePath, resolveReference, workspaceBoundary } from "../paths";

describe("external references", () => {
	it.each(["https://example.com/a.png", "http://x/y.gif", "data:image/png;base64,AAAA", "//cdn.example.com/a.png"])(
		"treats %s as external",
		(reference) => {
			expect(isExternalReference(reference)).toBe(true);
		},
	);

	it.each(["a.png", "./a.png", "../a.png", "/abs/a.png", "C:/Users/a.png", "C:\\Users\\a.png"])(
		"treats %s as a file path",
		(reference) => {
			expect(isExternalReference(reference)).toBe(false);
		},
	);
});

describe("resolving a reference against its document", () => {
	it.each([
		["/ws/docs/guide.md", "diagram.png", "/ws/docs/diagram.png"],
		["/ws/docs/guide.md", "./img/a.png", "/ws/docs/img/a.png"],
		["/ws/docs/guide.md", "../shared/logo.svg", "/ws/shared/logo.svg"],
		["/ws/docs/guide.md", "assets/boss%20arena.png", "/ws/docs/assets/boss arena.png"],
		["/ws/docs/guide.md", "a.png?v=2#frag", "/ws/docs/a.png"],
		["C:\\Users\\me\\ws\\guide.md", "assets/a.png", "C:/Users/me/ws/assets/a.png"],
		["/ws/guide.md", "/elsewhere/a.png", "/elsewhere/a.png"],
	])("%s + %s → %s", (documentPath, reference, expected) => {
		expect(resolveReference(documentPath, reference)).toBe(expected);
	});

	it("does not resolve an external reference to a file", () => {
		expect(resolveReference("/ws/guide.md", "https://example.com/a.png")).toBeNull();
	});

	it("still resolves after the workspace is cloned to a different location", () => {
		// The stored reference is relative to the document, so it names the same
		// file wherever the tree of files is placed.
		const reference = referenceFor("/home/alice/repo/docs/guide.md", "/home/alice/repo/docs/assets/map.png", "/home/alice/repo");
		expect(reference).toBe("assets/map.png");

		expect(resolveReference("D:\\clones\\repo\\docs\\guide.md", reference)).toBe("D:/clones/repo/docs/assets/map.png");
		expect(resolveReference("/tmp/other/repo/docs/guide.md", reference)).toBe("/tmp/other/repo/docs/assets/map.png");
	});
});

describe("the reference stored for a newly inserted image", () => {
	it("is relative to the document's own directory for a file inside the workspace", () => {
		expect(referenceFor("/ws/docs/guide.md", "/ws/docs/assets/a.png", "/ws")).toBe("assets/a.png");
		expect(referenceFor("/ws/docs/deep/guide.md", "/ws/images/a.png", "/ws")).toBe("../../images/a.png");
	});

	it("is the absolute path, as given, for a file outside the workspace", () => {
		expect(referenceFor("/ws/docs/guide.md", "/home/me/Pictures/a.png", "/ws")).toBe("/home/me/Pictures/a.png");
		expect(referenceFor("C:\\ws\\guide.md", "D:\\Pictures\\a.png", "C:\\ws")).toBe("D:\\Pictures\\a.png");
	});

	it("is the URL, unchanged, for an absolute URL", () => {
		const url = "https://example.com/render?id=42&size=large";

		expect(referenceFor("/ws/docs/guide.md", url, "/ws")).toBe(url);
	});

	it("treats a lone document's own directory as its workspace", () => {
		expect(workspaceBoundary("/notes/todo.md", null)).toBe("/notes");
		expect(referenceFor("/notes/todo.md", "/notes/pics/a.png", null)).toBe("pics/a.png");
		expect(referenceFor("/notes/todo.md", "/elsewhere/a.png", null)).toBe("/elsewhere/a.png");
	});

	it("ignores an open workspace the document is not part of", () => {
		expect(workspaceBoundary("/notes/todo.md", "/ws")).toBe("/notes");
	});

	it("compares a Windows drive letter case-insensitively", () => {
		expect(referenceFor("C:\\ws\\docs\\guide.md", "c:\\ws\\docs\\a.png", "C:\\ws")).toBe("a.png");
	});

	it("does not treat a sibling directory with a shared prefix as inside", () => {
		expect(referenceFor("/ws/guide.md", "/ws-other/a.png", "/ws")).toBe("/ws-other/a.png");
	});
});

describe("relativePath", () => {
	it("walks up and back down", () => {
		expect(relativePath("/a/b/c", "/a/d/e.png")).toBe("../../d/e.png");
	});
});

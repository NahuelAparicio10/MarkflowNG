import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";

/**
 * Smoke test: verifies the remark toolchain is wired before any core code exists.
 * Replaced by real round-trip tests once src/core/markdown lands.
 */
describe("toolchain", () => {
	it("parses and serializes markdown through unified", () => {
		const processor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
		const input = "# Hello\n\nWorld\n";
		const output = String(processor.processSync(input));
		expect(output).toBe(input);
	});
});

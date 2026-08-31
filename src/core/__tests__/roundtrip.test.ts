import { describe, expect, it } from "vitest";
import { parseMarkdown, serializeMarkdown } from "../markdown";
import { mdastToPm, pmToMdast } from "../mapping";
import { fixtures, normalizedFixtures, readFixture, stripPositions } from "./helpers";

/**
 * The invariants the whole project rests on.
 *
 * These are two different claims and they fail for different reasons, so they
 * are asserted separately. A text-invariant failure means the document was not
 * in the serializer normal form, which is benign. A structural-invariant
 * failure means the mapping lost information, which is a bug.
 */

describe("text invariant: serialize(parse(md)) === md", () => {
	it.each(normalizedFixtures.map((fixture) => [fixture.path, fixture] as const))(
		"%s",
		(_path, fixture) => {
			const source = readFixture(fixture);

			expect(serializeMarkdown(parseMarkdown(source))).toBe(source);
		},
	);
});

describe("structural invariant: a ProseMirror round trip preserves the tree", () => {
	it.each(fixtures.map((fixture) => [fixture.path, fixture] as const))("%s", (_path, fixture) => {
		const source = readFixture(fixture);
		const direct = parseMarkdown(source);
		const roundTripped = parseMarkdown(serializeMarkdown(pmToMdast(mdastToPm(direct))));

		expect(stripPositions(roundTripped)).toEqual(stripPositions(direct));
	});
});

describe("round trip is idempotent", () => {
	it.each(fixtures.map((fixture) => [fixture.path, fixture] as const))("%s", (_path, fixture) => {
		const source = readFixture(fixture);
		const once = serializeMarkdown(pmToMdast(mdastToPm(parseMarkdown(source))));
		const twice = serializeMarkdown(pmToMdast(mdastToPm(parseMarkdown(once))));

		// Passing a document through twice must not keep changing it. If this
		// fails while the structural invariant passes, the serializer normal
		// form is not actually a fixed point.
		expect(twice).toBe(once);
	});
});

describe("produced documents are schema-valid", () => {
	it.each(fixtures.map((fixture) => [fixture.path, fixture] as const))("%s", (_path, fixture) => {
		const doc = mdastToPm(parseMarkdown(readFixture(fixture)));

		expect(() => doc.check()).not.toThrow();
	});
});

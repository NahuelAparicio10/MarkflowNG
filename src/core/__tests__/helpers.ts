import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Node as MdastNode, Root } from "mdast";
import { FIXTURES, type Fixture } from "../fixtures/manifest";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export function readFixture(fixture: Fixture): string {
	return readFileSync(join(fixturesDir, fixture.path), "utf8");
}

export const fixtures = FIXTURES;
export const normalizedFixtures = FIXTURES.filter((fixture) => fixture.normalized);

/**
 * Removes remark's positional metadata from a tree.
 *
 * Offsets are meaningful on parse and meaningless after a ProseMirror round
 * trip, so they are stripped from both sides before comparison. Stripping
 * rather than using a position-skipping deep-equal keeps assertion diffs
 * readable: without it a failure shows two nodes that look identical.
 */
export function stripPositions<T extends MdastNode | Root>(tree: T): T {
	const clone = structuredClone(tree);

	const walk = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}

		if (node === null || typeof node !== "object") {
			return;
		}

		const record = node as Record<string, unknown>;
		delete record.position;

		for (const value of Object.values(record)) {
			walk(value);
		}
	};

	walk(clone);

	return clone;
}

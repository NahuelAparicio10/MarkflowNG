/**
 * The fixture corpus, and which fixtures are in the serializer normal form.
 *
 * The distinction matters because the two round-trip invariants are not the
 * same claim. The text invariant only holds for documents already written the
 * way the serializer writes them; asserting it over a document with unusual but
 * valid formatting would fail for a benign reason and hide real mapping bugs.
 * The structural invariant holds for everything.
 */
export interface Fixture {
	/** Path relative to this directory. */
	path: string;
	/** Whether `serialize(parse(source)) === source` is expected to hold. */
	normalized: boolean;
	/** Why this fixture exists, so a failure says what broke. */
	covers: string;
}

export const FIXTURES: readonly Fixture[] = [
	{
		path: "edge/empty.md",
		normalized: true,
		covers: "an empty document, which parses to a root with no children",
	},
	{
		path: "edge/empty-heading.md",
		normalized: true,
		covers: "a heading with no text content",
	},
	{
		path: "edge/consecutive-paragraphs.md",
		normalized: true,
		covers: "consecutive paragraphs, where block separation must be preserved",
	},
	{
		path: "edge/all-heading-levels.md",
		normalized: true,
		covers: "every heading level from 1 to 6",
	},
	{
		path: "edge/headings-and-paragraphs.md",
		normalized: true,
		covers: "the ordinary mix of headings and body text",
	},
	{
		path: "edge/no-headings.md",
		normalized: true,
		covers: "a document with no headings at all",
	},
	{
		path: "edge/trailing-blank-lines.md",
		normalized: false,
		covers: "trailing blank lines at end of file, which the serializer drops",
	},
	{
		path: "edge/non-normal-form.md",
		normalized: false,
		covers: "valid Markdown written in a different form than the serializer emits",
	},
	{
		path: "real/readme.md",
		normalized: false,
		covers: "a real document from this repository",
	},
	{
		path: "real/architecture.md",
		normalized: false,
		covers: "a real document with tables, code blocks and nested structure",
	},
	{
		path: "real/explore.md",
		normalized: false,
		covers: "the largest real document available, with tables, code fences and lists",
	},
];

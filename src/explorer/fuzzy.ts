/**
 * Fuzzy matching for quick open. Runs entirely in the frontend over the cached
 * listing (design decision D3), so it has to be cheap: one linear pass per
 * candidate, no dynamic programming. The approach is fzf's original one — find
 * the query as a subsequence, then tighten the match to the shortest window
 * ending where it ended — plus a second attempt confined to the file name,
 * since that is usually what the user is typing.
 *
 * Hand-rolled rather than pulling in uFuzzy or an fzf port (both floated in
 * `Context/EXPLORE.md`): the listing is paths only, and this is the whole of
 * what is needed.
 */

export interface FuzzyResult {
	path: string;
	score: number;
	/** Indices into `path` of the matched characters, ascending. */
	positions: number[];
}

const SCORE_MATCH = 16;
const BONUS_CONSECUTIVE = 24;
const BONUS_BOUNDARY = 30;
const BONUS_CAMEL = 20;
const BONUS_FILE_NAME = 12;
const PENALTY_GAP = 3;
const MAX_GAP_PENALTY = 30;
const PENALTY_LEADING = 1;
const MAX_LEADING_PENALTY = 15;

function isBoundary(character: string): boolean {
	return character === "/" || character === "\\" || character === "-" || character === "_" || character === "." || character === " ";
}

/**
 * Finds `query` in `text[from..]` as a case-insensitive subsequence and
 * returns the positions of the tightest match ending at the first possible
 * end, or `null` if there is none.
 */
function locate(query: string, text: string, lowerText: string, from: number): number[] | null {
	let queryIndex = 0;
	let end = -1;

	for (let index = from; index < text.length; index++) {
		if (lowerText[index] === query[queryIndex]) {
			queryIndex++;
			if (queryIndex === query.length) {
				end = index;
				break;
			}
		}
	}

	if (end < 0) {
		return null;
	}

	// Walk back from the end, matching the query right to left, which yields
	// the latest start and so the shortest window.
	const positions = new Array<number>(query.length);
	queryIndex = query.length - 1;
	for (let index = end; index >= from && queryIndex >= 0; index--) {
		if (lowerText[index] === query[queryIndex]) {
			positions[queryIndex] = index;
			queryIndex--;
		}
	}

	return positions;
}

function scorePositions(text: string, positions: number[], fileNameStart: number): number {
	let score = 0;

	for (let index = 0; index < positions.length; index++) {
		const position = positions[index];
		score += SCORE_MATCH;

		const previous = position > 0 ? text[position - 1] : "/";
		if (isBoundary(previous)) {
			score += BONUS_BOUNDARY;
		} else if (previous === previous.toLowerCase() && text[position] !== text[position].toLowerCase()) {
			score += BONUS_CAMEL;
		}

		if (index > 0) {
			const gap = position - positions[index - 1] - 1;
			score += gap === 0 ? BONUS_CONSECUTIVE : -Math.min(gap * PENALTY_GAP, MAX_GAP_PENALTY);
		}

		if (position >= fileNameStart) {
			score += BONUS_FILE_NAME;
		}
	}

	score -= Math.min(positions[0] * PENALTY_LEADING, MAX_LEADING_PENALTY);
	return score;
}

/**
 * Matches `query` against `path`, ignoring case and whitespace in the query.
 * Characters need not be contiguous: `cmbt` matches `design/combat.md`.
 * Returns `null` when the path does not contain the query as a subsequence.
 */
export function fuzzyMatch(query: string, path: string): Omit<FuzzyResult, "path"> | null {
	const normalizedQuery = query.replace(/\s+/g, "").toLowerCase();
	if (normalizedQuery === "") {
		return { score: 0, positions: [] };
	}

	const lowerPath = path.toLowerCase();
	const fileNameStart = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1;

	const anywhere = locate(normalizedQuery, path, lowerPath, 0);
	if (!anywhere) {
		return null;
	}

	let best = { score: scorePositions(path, anywhere, fileNameStart), positions: anywhere };

	// The same query aligned inside the file name alone, when it fits there,
	// usually reads better than a match smeared across folders.
	if (!normalizedQuery.includes("/") && fileNameStart > 0) {
		const inFileName = locate(normalizedQuery, path, lowerPath, fileNameStart);
		if (inFileName) {
			const score = scorePositions(path, inFileName, fileNameStart);
			if (score > best.score) {
				best = { score, positions: inFileName };
			}
		}
	}

	return best;
}

/**
 * Ranks `paths` against `query`, best first, and keeps the top `limit`. Ties
 * go to the shorter path, then alphabetical order. An empty query lists
 * paths in their given order.
 */
export function rankFuzzy(query: string, paths: readonly string[], limit: number): FuzzyResult[] {
	if (query.trim() === "") {
		return paths.slice(0, limit).map((path) => ({ path, score: 0, positions: [] }));
	}

	const results: FuzzyResult[] = [];
	for (const path of paths) {
		const match = fuzzyMatch(query, path);
		if (match) {
			results.push({ path, ...match });
		}
	}

	results.sort((a, b) => b.score - a.score || a.path.length - b.path.length || (a.path < b.path ? -1 : 1));
	return results.slice(0, limit);
}

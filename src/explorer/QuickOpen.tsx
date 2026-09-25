import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { selectMarkdownFiles, useWorkspaceStore } from "../store/workspace";
import { rankFuzzy } from "./fuzzy";

/** How many results are listed; more would only be scrolled past. */
const RESULT_LIMIT = 50;

interface QuickOpenProps {
	/** Opens a Markdown file, by root-relative path. */
	onOpen(relativePath: string): void;
	onClose(): void;
}

/**
 * Fuzzy quick open over the workspace's Markdown files. Filters the listing
 * cached in the workspace store, entirely in the frontend: typing issues no
 * backend call (design decision D3). Mounted only while shown, so every
 * invocation starts from an empty query and reads the listing as it is now.
 */
export default function QuickOpen({ onOpen, onClose }: QuickOpenProps) {
	const files = useWorkspaceStore(selectMarkdownFiles);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);

	const results = useMemo(() => rankFuzzy(query, files, RESULT_LIMIT), [query, files]);
	const safeIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

	function choose(index: number) {
		const result = results[index];
		if (result) {
			onOpen(result.path);
			onClose();
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		switch (event.key) {
			case "ArrowDown": {
				setActiveIndex(Math.min(safeIndex + 1, results.length - 1));
				break;
			}
			case "ArrowUp": {
				setActiveIndex(Math.max(safeIndex - 1, 0));
				break;
			}
			case "Enter": {
				choose(safeIndex);
				break;
			}
			case "Escape": {
				onClose();
				break;
			}
			default:
				return;
		}

		event.preventDefault();
	}

	return (
		<div className="markflow-quick-open-backdrop" onMouseDown={onClose}>
			<div
				className="markflow-quick-open"
				role="dialog"
				aria-label="Quick open"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<input
					autoFocus
					type="text"
					role="combobox"
					aria-expanded="true"
					aria-controls="markflow-quick-open-results"
					aria-activedescendant={results.length > 0 ? `markflow-quick-open-${safeIndex}` : undefined}
					placeholder="Go to file…"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={handleKeyDown}
				/>
				<ul id="markflow-quick-open-results" role="listbox">
					{results.map((result, index) => (
						<li
							key={result.path}
							id={`markflow-quick-open-${index}`}
							role="option"
							aria-selected={index === safeIndex}
							onMouseEnter={() => setActiveIndex(index)}
							onClick={() => choose(index)}
						>
							{highlight(result.path, result.positions)}
						</li>
					))}
					{results.length === 0 ? <li className="markflow-quick-open-empty">No matching files</li> : null}
				</ul>
			</div>
		</div>
	);
}

/** `path` with the matched characters wrapped in `<mark>`. */
function highlight(path: string, positions: number[]): ReactNode[] {
	const matched = new Set(positions);
	const parts: ReactNode[] = [];
	let run = "";
	let runMatched = false;

	const flush = (key: number) => {
		if (run !== "") {
			parts.push(runMatched ? <mark key={key}>{run}</mark> : run);
			run = "";
		}
	};

	for (let index = 0; index < path.length; index++) {
		const isMatched = matched.has(index);
		if (isMatched !== runMatched) {
			flush(index);
			runMatched = isMatched;
		}
		run += path[index];
	}
	flush(path.length);

	return parts;
}

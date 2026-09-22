import { useEffect, useState } from "react";
import { useSessionStore } from "../store/session";

/**
 * Navigable outline for the open document. Empty and error-free when the
 * document has no headings. Active-entry tracking uses `IntersectionObserver`
 * rather than a scroll listener, so it costs nothing between visibility
 * changes instead of running on every scroll frame — see design decision D6.
 */
export default function OutlinePanel() {
	const entries = useSessionStore((state) => state.outline.entries);
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		if (entries.length === 0) {
			// Nothing to observe, and the component renders nothing below when
			// there are no entries, so any stale `activeId` from a previous
			// document is inert rather than worth clearing here.
			return;
		}

		const visibleIds = new Set<string>();

		const observer = new IntersectionObserver(
			(observedEntries) => {
				for (const entry of observedEntries) {
					if (entry.isIntersecting) {
						visibleIds.add(entry.target.id);
					} else {
						visibleIds.delete(entry.target.id);
					}
				}

				// The topmost visible heading, in document order, is the active one.
				const topmost = entries.find((entry) => visibleIds.has(entry.id));
				if (topmost) {
					setActiveId(topmost.id);
				}
			},
			// Treats a heading as "topmost visible" once it clears the upper 20% of
			// the viewport, rather than requiring it to be fully in view.
			{ rootMargin: "0px 0px -80% 0px", threshold: 0 },
		);

		for (const entry of entries) {
			const element = document.getElementById(entry.id);
			if (element) {
				observer.observe(element);
			}
		}

		return () => observer.disconnect();
	}, [entries]);

	if (entries.length === 0) {
		return null;
	}

	function handleSelect(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	return (
		<nav className="markflow-outline" aria-label="Document outline">
			<ul>
				{entries.map((entry) => (
					<li
						key={entry.id}
						style={{ paddingLeft: `${(entry.depth - 1) * 12}px` }}
						className={entry.id === activeId ? "markflow-outline-active" : undefined}
					>
						<button type="button" onClick={() => handleSelect(entry.id)}>
							{entry.text || "(untitled)"}
						</button>
					</li>
				))}
			</ul>
		</nav>
	);
}

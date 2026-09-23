import type { Image } from "mdast";
import { useEffect, useState } from "react";
import { decodeTitle } from "../core/images/titleSize";
import { externalSource, loadImageSource } from "../images/imageSource";

interface MarkdownImageProps {
	node: Image;
	/** The document the image belongs to, which relative references resolve against. */
	documentPath: string | null;
}

type Loaded = { reference: string; src: string } | { reference: string; missing: true };

/**
 * An image in the reader, drawn the way the editor draws it: resolved against
 * the document's directory, at its encoded display width, with the encoding
 * kept out of the tooltip, and a placeholder naming the reference when the
 * file cannot be loaded.
 *
 * A local file is never written into `src` as the raw reference: inside the
 * webview a relative URL resolves against the application, not the document,
 * and would show the wrong thing or nothing.
 */
export default function MarkdownImage({ node, documentPath }: MarkdownImageProps) {
	const { title, width } = decodeTitle(node.title);
	const external = externalSource(node.url);
	const [loaded, setLoaded] = useState<Loaded | null>(null);

	useEffect(() => {
		if (external !== null) {
			return;
		}

		let cancelled = false;
		const reference = node.url;

		loadImageSource(documentPath, reference).then(
			(src) => {
				if (!cancelled) {
					setLoaded({ reference, src });
				}
			},
			() => {
				if (!cancelled) {
					setLoaded({ reference, missing: true });
				}
			},
		);

		return () => {
			cancelled = true;
		};
	}, [documentPath, node.url, external]);

	// A result for a previous reference is stale once the node changes.
	const current = loaded?.reference === node.url ? loaded : null;

	if (current && "missing" in current) {
		return <span className="markflow-image-missing">Image not found: {node.url}</span>;
	}

	const src = external ?? (current && "src" in current ? current.src : undefined);

	return (
		<img
			src={src}
			alt={node.alt ?? ""}
			title={title ?? undefined}
			width={width ?? undefined}
			onError={() => setLoaded({ reference: node.url, missing: true })}
		/>
	);
}

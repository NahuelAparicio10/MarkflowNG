import type {
	Blockquote,
	Break,
	Code,
	Delete,
	Emphasis,
	Heading,
	Html,
	Image,
	InlineCode,
	Link,
	List,
	ListItem,
	Paragraph,
	Parent,
	Root,
	RootContent,
	Strong,
	Table,
	TableCell,
	TableRow,
	Text,
	ThematicBreak,
	Yaml,
} from "mdast";
import type { ReactNode } from "react";
import MarkdownImage from "./MarkdownImage";
import CodeBlock from "./CodeBlock";

/** Everything a per-node renderer needs, without importing the dispatcher. */
export interface RenderContext {
	/** Stable DOM anchor id per heading node, keyed by node identity. */
	headingIds: ReadonlyMap<Heading, string>;
	/**
	 * The file being rendered, which relative image references resolve
	 * against; `null` when there is none, and local images show as missing.
	 */
	documentPath: string | null;
}

type AnyNode = Root | RootContent;

type NodeRenderer<T extends AnyNode> = (node: T, key: number, context: RenderContext) => ReactNode;

/**
 * Declares a renderer narrowly typed to the node it handles, storing it as the
 * widened type the dispatch map holds.
 *
 * The widening is sound because dispatch is keyed by `node.type`: a renderer is
 * only ever invoked with a node of the type it declared. Doing it here means no
 * call site needs a cast of its own, mirroring `defineNodeHandler` in
 * `src/core/mapping/registry.ts`.
 */
function defineRenderer<T extends AnyNode>(renderer: NodeRenderer<T>): NodeRenderer<AnyNode> {
	return renderer as unknown as NodeRenderer<AnyNode>;
}

function renderChildren(parent: Parent, context: RenderContext): ReactNode[] {
	return (parent.children as RootContent[]).map((child, index) => renderNode(child, index, context));
}

const UNSAFE_URL_PATTERN = /^\s*javascript:/i;

/**
 * Strips `javascript:` URLs so a Markdown link cannot run script. Images apply
 * the same rule in `src/images/imageSource.ts`.
 */
function safeUrl(url: string): string | undefined {
	return UNSAFE_URL_PATTERN.test(url) ? undefined : url;
}

const renderers: Record<string, NodeRenderer<AnyNode>> = {
	root: defineRenderer<Root>((node, _key, context) => <>{renderChildren(node, context)}</>),

	heading: defineRenderer<Heading>((node, key, context) => {
		const Tag = `h${node.depth}` as const;
		return (
			<Tag key={key} id={context.headingIds.get(node)}>
				{renderChildren(node, context)}
			</Tag>
		);
	}),

	paragraph: defineRenderer<Paragraph>((node, key, context) => (
		<p key={key}>{renderChildren(node, context)}</p>
	)),

	text: defineRenderer<Text>((node) => node.value),

	emphasis: defineRenderer<Emphasis>((node, key, context) => (
		<em key={key}>{renderChildren(node, context)}</em>
	)),

	strong: defineRenderer<Strong>((node, key, context) => (
		<strong key={key}>{renderChildren(node, context)}</strong>
	)),

	delete: defineRenderer<Delete>((node, key, context) => (
		<del key={key}>{renderChildren(node, context)}</del>
	)),

	inlineCode: defineRenderer<InlineCode>((node, key) => <code key={key}>{node.value}</code>),

	break: defineRenderer<Break>((_node, key) => <br key={key} />),

	link: defineRenderer<Link>((node, key, context) => (
		<a key={key} href={safeUrl(node.url)} title={node.title ?? undefined} target="_blank" rel="noreferrer noopener">
			{renderChildren(node, context)}
		</a>
	)),

	image: defineRenderer<Image>((node, key, context) => (
		<MarkdownImage key={key} node={node} documentPath={context.documentPath} />
	)),

	list: defineRenderer<List>((node, key, context) => {
		const Tag = node.ordered ? "ol" : "ul";
		const isTaskList = node.children.some((item) => typeof item.checked === "boolean");
		return (
			<Tag
				key={key}
				start={node.ordered && node.start != null ? node.start : undefined}
				className={isTaskList ? "markflow-task-list" : undefined}
			>
				{renderChildren(node, context)}
			</Tag>
		);
	}),

	listItem: defineRenderer<ListItem>((node, key, context) => {
		if (typeof node.checked !== "boolean") {
			return <li key={key}>{renderChildren(node, context)}</li>;
		}

		return (
			<li key={key} className="markflow-task-item">
				<input type="checkbox" checked={node.checked} disabled />
				{renderChildren(node, context)}
			</li>
		);
	}),

	blockquote: defineRenderer<Blockquote>((node, key, context) => {
		const first = node.children[0];
		const warning = first?.type === "paragraph" && first.children[0]?.type === "text" && first.children[0].value.trimStart().startsWith("[!WARNING]");
		return <blockquote key={key} className={warning ? "markflow-callout-warning" : undefined}>{renderChildren(node, context)}</blockquote>;
	}),

	code: defineRenderer<Code>((node, key) => <CodeBlock key={key} value={node.value} language={node.lang} />),

	thematicBreak: defineRenderer<ThematicBreak>((_node, key) => <hr key={key} />),

	html: defineRenderer<Html>((node, key) => (
		// Rendered as inert text, never executed: a malicious `.md` file must not
		// gain script execution inside a webview that has Tauri IPC access.
		<pre key={key} className="markflow-raw-html">
			{node.value}
		</pre>
	)),

	// Frontmatter is document metadata, not body content. The reader shows no
	// Markdown syntax, and that includes the frontmatter delimiters themselves.
	yaml: defineRenderer<Yaml>(() => null),

	table: defineRenderer<Table>((node, key, context) => {
		const [headRow, ...bodyRows] = node.children;
		const align = node.align ?? [];
		// Rows are padded to the widest one, as the editor pads them on load,
		// so a ragged table shows the same grid in both modes.
		const width = node.children.reduce((widest, row) => Math.max(widest, row.children.length), 0);

		const renderCell = (cell: TableCell, columnIndex: number, isHeader: boolean) => {
			const Tag = isHeader ? "th" : "td";
			const textAlign = align[columnIndex];
			return (
				<Tag key={columnIndex} style={textAlign ? { textAlign } : undefined}>
					{renderChildren(cell, context)}
				</Tag>
			);
		};

		const renderRow = (row: TableRow, rowKey: number, isHeader: boolean) => {
			const cells = row.children.map((cell, columnIndex) => renderCell(cell, columnIndex, isHeader));
			for (let columnIndex = row.children.length; columnIndex < width; columnIndex++) {
				cells.push(renderCell({ type: "tableCell", children: [] }, columnIndex, isHeader));
			}
			return <tr key={rowKey}>{cells}</tr>;
		};

		return (
			<div key={key} className="markflow-table-scroll">
			<table>
				{headRow ? <thead>{renderRow(headRow, 0, true)}</thead> : null}
				{bodyRows.length > 0 ? <tbody>{bodyRows.map((row, index) => renderRow(row, index, false))}</tbody> : null}
			</table>
			</div>
		);
	}),

	// Never dispatched directly: `table` renders its rows and cells itself so it
	// can split the head row from the body and apply column alignment.
	tableRow: defineRenderer<TableRow>(() => null),
	tableCell: defineRenderer<TableCell>(() => null),
};

/** Dispatches a single mdast node to its renderer, or drops it if none is registered. */
export function renderNode(node: AnyNode, key: number, context: RenderContext): ReactNode {
	const renderer = renderers[node.type];

	return renderer ? renderer(node, key, context) : null;
}

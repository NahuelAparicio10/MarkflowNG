import type { Mark, Node as PmNode } from "@tiptap/pm/model";
import type { PhrasingContent } from "mdast";
import type { NodeHandlerPair, PmToMdastContext } from "../types";

/** Finds the handler pair registered for a ProseMirror type name. */
export type HandlerLookup = (pmType: string) => NodeHandlerPair | undefined;

/**
 * Wrappers that CommonMark only recognises when their content does not start
 * or end with whitespace. `**word **` is not bold, so a mark applied to a
 * selection that includes a trailing space must leave the space outside.
 */
const FLANKED_TYPES = new Set(["strong", "emphasis", "delete"]);

interface OpenMark {
	mark: Mark;
	/** The node the mark was opened on, from which its handler reads attributes. */
	node: PmNode;
	children: PhrasingContent[];
}

/**
 * Converts the inline content of a textblock into mdast phrasing content.
 *
 * In mdast, formatting is nesting (`strong` is a parent of `text`); in
 * ProseMirror it is a set of marks on each inline node. Converting back
 * therefore needs the whole run of siblings, not one node at a time, which is
 * why textblock handlers call this instead of `convertChildren`.
 *
 * Each mark is converted by its own registered handler pair, keyed by mark
 * name. The mark's `toMdast` is called with the node the mark was opened on and
 * a context whose `convertChildren` returns the already-converted content the
 * mark spans, so a mark handler has the same shape as a node handler. A mark
 * whose spec sets `code` is a leaf in mdast and is converted in place of the
 * text it covers.
 */
export function phrasingToMdast(
	parent: PmNode,
	context: PmToMdastContext,
	lookup: HandlerLookup,
): PhrasingContent[] {
	const inline: PmNode[] = [];
	parent.forEach((child) => inline.push(child));

	const root: PhrasingContent[] = [];
	const stack: OpenMark[] = [];

	function currentChildren(): PhrasingContent[] {
		return stack.length > 0 ? stack[stack.length - 1].children : root;
	}

	function handlerFor(mark: Mark): NodeHandlerPair {
		const handler = lookup(mark.type.name);

		if (!handler) {
			throw new Error(`No mapping handler for ProseMirror mark type: ${mark.type.name}`);
		}

		return handler;
	}

	function closeMark(): void {
		const entry = stack.pop() as OpenMark;
		const wrapped = handlerFor(entry.mark).toMdast(entry.node, {
			...context,
			convertChildren: () => entry.children,
		}) as PhrasingContent[];

		for (const node of wrapped) {
			appendAll(currentChildren(), expelWhitespace(node));
		}
	}

	/** How many consecutive siblings, starting at `index`, carry `mark`. */
	function runLength(mark: Mark, index: number): number {
		let end = index;

		while (end < inline.length && mark.isInSet(inline[end].marks)) {
			end++;
		}

		return end - index;
	}

	inline.forEach((node, index) => {
		const codeMark = node.marks.find((mark) => mark.type.spec.code);
		const marks = node.marks.filter((mark) => !mark.type.spec.code);

		// Keep the longest prefix of open marks this node still carries; close
		// everything opened inside the first one it does not.
		let keep = 0;
		while (keep < stack.length && stack[keep].mark.isInSet(marks)) {
			keep++;
		}
		while (stack.length > keep) {
			closeMark();
		}

		// The mark that continues furthest is opened outermost, so that it is
		// not split around a shorter one. Ties keep schema rank order, since the
		// sort is stable and node.marks is already rank-sorted.
		const toOpen = marks
			.filter((mark) => !stack.some((entry) => entry.mark.eq(mark)))
			.sort((a, b) => runLength(b, index) - runLength(a, index));

		for (const mark of toOpen) {
			stack.push({ mark, node, children: [] });
		}

		const leaf = codeMark ? handlerFor(codeMark).toMdast(node, context) : context.convertNode(node);
		appendAll(currentChildren(), leaf as PhrasingContent[]);
	});

	while (stack.length > 0) {
		closeMark();
	}

	return root;
}

/**
 * The forward half of a mark handler: adds `mark` to every inline node an mdast
 * wrapper converted to. `addToSet` keeps the set rank-sorted and deduplicated.
 */
export function addMark(nodes: PmNode[], mark: Mark): PmNode[] {
	return nodes.map((node) => node.mark(mark.addToSet(node.marks)));
}

/** Appends nodes, merging adjacent text so the tree matches what remark parses. */
function appendAll(target: PhrasingContent[], nodes: PhrasingContent[]): void {
	for (const node of nodes) {
		const last = target[target.length - 1];

		if (node.type === "text" && last?.type === "text") {
			last.value += node.value;
			continue;
		}

		target.push(node);
	}
}

/**
 * Moves leading and trailing whitespace out of a flanked wrapper, dropping the
 * wrapper entirely if nothing else is left in it.
 */
function expelWhitespace(node: PhrasingContent): PhrasingContent[] {
	if (!FLANKED_TYPES.has(node.type) || !("children" in node)) {
		return [node];
	}

	const children = node.children;
	let leading = "";
	let trailing = "";

	const first = children[0];
	if (first?.type === "text") {
		leading = /^\s*/.exec(first.value)?.[0] ?? "";
		first.value = first.value.slice(leading.length);
	}

	const last = children[children.length - 1];
	if (last?.type === "text") {
		trailing = /\s*$/.exec(last.value)?.[0] ?? "";
		last.value = last.value.slice(0, last.value.length - trailing.length);
	}

	const remaining = children.filter((child) => child.type !== "text" || child.value !== "");
	node.children = remaining as typeof node.children;

	const result: PhrasingContent[] = [];

	if (leading) {
		result.push({ type: "text", value: leading });
	}
	if (remaining.length > 0) {
		result.push(node);
	}
	if (trailing) {
		result.push({ type: "text", value: trailing });
	}

	return result;
}

import { undo } from "@tiptap/pm/history";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { afterAll, describe, expect, it } from "vitest";
import { schema } from "../../core/schema";
import type { ImageAttrs } from "../images";
import { createInputRulesPlugin, INPUT_RULES } from "../inputRules";
import {
	createSlashCommandRegistry,
	createSlashMenuPlugin,
	findSlashCommands,
	runSlashMenuItem,
	slashCommands,
	slashMenuKey,
	type SlashCommand,
	type SlashCommandHost,
	type SlashMenuState,
} from "../slashMenu";
import { CONTRIBUTED_COMMAND_ID, removeContributedCommand } from "./contributedCommand";
import { createTestView, docFrom, emptyDoc, markdownOf, pressKey, typeText, type TestView } from "./harness";

afterAll(() => removeContributedCommand());

const noImages: SlashCommandHost = { chooseImages: async () => [] };

/**
 * An editor with the slash menu ahead of the input rules, in the order the
 * extension priorities give them.
 */
function setup(options: { doc?: ReturnType<typeof emptyDoc>; at?: number; host?: SlashCommandHost; registry?: typeof slashCommands } = {}) {
	const slash = createSlashMenuPlugin(options.registry ?? slashCommands, options.host ?? noImages);
	const rules = createInputRulesPlugin(INPUT_RULES, () => true);
	const plugins = [slash, rules];
	const view = createTestView(options.doc ?? emptyDoc(), plugins, options.at ?? 1);

	return {
		view,
		type: (text: string) => typeText(view, text, plugins),
		press: (key: string) => pressKey(view, key, plugins),
		menu: () => slashMenuKey.getState(view.state) as SlashMenuState,
		ids: () => (slashMenuKey.getState(view.state) as SlashMenuState).items.map((item) => item.id),
	};
}

function asView(view: TestView) {
	return view as unknown as EditorView;
}

function run(view: TestView, id: string) {
	const index = (slashMenuKey.getState(view.state) as SlashMenuState).items.findIndex((item) => item.id === id);
	expect(index).toBeGreaterThanOrEqual(0);

	return runSlashMenuItem(asView(view), index);
}

function firstBlock(view: TestView) {
	return view.state.doc.child(0);
}

/** The block types the menu must be able to insert, per the "Insertion commands" requirement. */
const INSERTABLE = [
	"heading1",
	"heading2",
	"heading3",
	"heading4",
	"heading5",
	"heading6",
	"bulletList",
	"orderedList",
	"taskList",
	"blockquote",
	"codeBlock",
	"table",
	"image",
	"thematicBreak",
];

describe("command registry", () => {
	it("shows a command registered from an unrelated module, without touching the menu", () => {
		const { type, ids } = setup();
		type("/");

		expect(ids()).toContain(CONTRIBUTED_COMMAND_ID);
	});

	it("runs a contributed command like any other", async () => {
		const { view, type } = setup();
		type("/contrib");

		expect(await run(view, CONTRIBUTED_COMMAND_ID)).toBe(true);
		expect(firstBlock(view).textContent).toBe("contributed");
	});

	it("hides commands whose availability predicate is false", () => {
		const registry = createSlashCommandRegistry();
		const entry = (id: string, available: boolean): SlashCommand => ({
			id,
			label: id,
			keywords: [],
			group: "Test",
			isAvailable: () => available,
			run: async () => undefined,
		});
		registry.register(entry("shown", true));
		registry.register(entry("hidden", false));

		const { type, ids } = setup({ registry });
		type("/");

		expect(ids()).toEqual(["shown"]);
	});

	it("hides the table entry inside a table, where GFM cannot nest one", () => {
		const doc = docFrom("| a |\n| - |\n| b |\n");
		const inCell = TextSelection.create(doc, 4);
		const view = createTestView(doc, [], inCell.from);

		expect(findSlashCommands(slashCommands, view.state, "").map((item) => item.id)).not.toContain("table");
	});

	it("replaces an entry registered again under the same id, keeping its place", () => {
		const registry = createSlashCommandRegistry();
		const base = { keywords: [], group: "Test", isAvailable: () => true, run: async () => undefined };
		registry.register({ ...base, id: "a", label: "A" });
		registry.register({ ...base, id: "b", label: "B" });
		registry.register({ ...base, id: "a", label: "A again" });

		expect(registry.list().map((item) => item.label)).toEqual(["A again", "B"]);
	});
});

describe("trigger", () => {
	it("opens over a selection and filters without editing, including no-match recovery", () => {
		const registry = createSlashCommandRegistry();
		registry.register({ id: "rewrite", label: "Rewrite", keywords: [], group: "AI", supportsSelection: true,
			isAvailable: (state) => !state.selection.empty, run: async () => undefined });
		const plugin = createSlashMenuPlugin(registry, noImages);
		const view = createTestView(docFrom("Selected text"), [plugin]);
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 9)));
		const before = markdownOf(view);
		const selection = view.state.selection;
		const event = { code: "Space", ctrlKey: true, shiftKey: true } as KeyboardEvent;
		expect(plugin.props.handleKeyDown?.call(plugin, asView(view), event)).toBe(true);
		typeText(view, "rewriteX", plugin);
		expect(slashMenuKey.getState(view.state)?.items).toHaveLength(0);
		pressKey(view, "Backspace", plugin);
		expect(slashMenuKey.getState(view.state)?.items[0].id).toBe("rewrite");
		expect(view.state.selection.eq(selection)).toBe(true);
		expect(markdownOf(view)).toBe(before);
		pressKey(view, "Escape", plugin);
		expect(slashMenuKey.getState(view.state)?.active).toBe(false);
		expect(markdownOf(view)).toBe(before);
	});

	it("dismisses selection invocation when the selected range changes", () => {
		const plugin = createSlashMenuPlugin(createSlashCommandRegistry(), noImages);
		const view = createTestView(docFrom("Selected text"), [plugin]);
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 9)));
		plugin.props.handleKeyDown?.call(plugin, asView(view), { code: "Space", metaKey: true, shiftKey: true } as KeyboardEvent);
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 9)));
		expect(slashMenuKey.getState(view.state)?.active).toBe(false);
	});

	it("opens on a slash typed in an empty paragraph", () => {
		const { menu, type } = setup();
		type("/");

		expect(menu().active).toBe(true);
		expect(menu().query).toBe("");
	});

	it("does not open on a slash typed mid-sentence, such as in a path", () => {
		const { view, menu, type } = setup();
		type("see src/core/ for it");

		expect(menu().active).toBe(false);
		expect(firstBlock(view).textContent).toBe("see src/core/ for it");
	});

	it("does not open at the start of a paragraph that already has text", () => {
		const doc = docFrom("text\n");
		const { menu, type } = setup({ doc, at: 1 });
		type("/");

		expect(menu().active).toBe(false);
	});

	it("does not open in a code block", () => {
		const doc = schema.node("doc", null, [schema.node("codeBlock", { language: null })]);
		const { view, menu, type } = setup({ doc, at: 1 });
		type("/");

		expect(menu().active).toBe(false);
		expect(firstBlock(view).textContent).toBe("/");
	});

	it("does not open in an empty heading", () => {
		const doc = schema.node("doc", null, [schema.node("heading", { level: 2 })]);
		const { menu, type } = setup({ doc, at: 1 });
		type("/");

		expect(menu().active).toBe(false);
	});
});

describe("no conflict with input rules", () => {
	it("types the filter literally, so Markdown syntax in it never converts", () => {
		const { view, menu, type } = setup();
		type("/- ");

		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("/- ");
		// A leading space after the slash reads as prose, and closes the menu.
		expect(menu().active).toBe(false);
	});

	it("keeps block input rules working with the menu installed", () => {
		const { view, type } = setup();
		type("# Title");

		expect(firstBlock(view).type.name).toBe("heading");
		expect(firstBlock(view).textContent).toBe("Title");
	});

	it("keeps input rules working after the menu is dismissed", () => {
		const { view, press, type } = setup();
		type("/co");
		press("Escape");
		type(" **bold** ");

		expect(firstBlock(view).child(1).marks.map((mark) => mark.type.name)).toEqual(["strong"]);
	});
});

describe("filtering and keyboard interaction", () => {
	it("filters by a fragment of the label", () => {
		const { type, ids } = setup();
		type("/quo");

		expect(ids()).toEqual(["blockquote"]);
	});

	it("filters by a keyword absent from the label", () => {
		const { type, ids } = setup();
		type("/bullet");
		expect(ids()).toEqual(["bulletList"]);
	});

	it("finds the task list by 'todo' and the code block by 'snippet'", () => {
		const first = setup();
		first.type("/todo");
		expect(first.ids()).toEqual(["taskList"]);

		const second = setup();
		second.type("/snippet");
		expect(second.ids()).toEqual(["codeBlock"]);
	});

	it("groups entries into sections, listed in section order", () => {
		const { menu, type } = setup();
		type("/");

		const groups = menu().items.map((item) => item.group);
		const sections = groups.filter((group, index) => index === 0 || groups[index - 1] !== group);
		expect(sections).toEqual([...new Set(groups)]);
		expect(sections.slice(0, 3)).toEqual(["Text", "Lists", "Insert"]);
	});

	it("moves the selection with the arrow keys without moving the caret", () => {
		const { view, menu, press, type } = setup();
		type("/");
		const caret = view.state.selection.from;

		expect(press("ArrowDown")).toBe(true);
		expect(press("ArrowDown")).toBe(true);
		expect(menu().selected).toBe(2);
		expect(press("ArrowUp")).toBe(true);
		expect(menu().selected).toBe(1);
		expect(view.state.selection.from).toBe(caret);
	});

	it("wraps the selection around both ends", () => {
		const { menu, press, type } = setup();
		type("/");

		press("ArrowUp");
		expect(menu().selected).toBe(menu().items.length - 1);
		press("ArrowDown");
		expect(menu().selected).toBe(0);
	});

	it("resets the selection when the filter changes", () => {
		const { menu, press, type } = setup();
		type("/");
		press("ArrowDown");
		type("h");

		expect(menu().selected).toBe(0);
	});

	it("runs the selected entry on Enter, without Enter creating a block", () => {
		const { view, menu, press, type } = setup();
		type("/heading");
		press("ArrowDown");

		expect(press("Enter")).toBe(true);
		expect(view.state.doc.childCount).toBe(1);
		expect(firstBlock(view).type.name).toBe("heading");
		expect(firstBlock(view).attrs.level).toBe(2);
		expect(menu().active).toBe(false);
	});

	it("releases the arrow keys and Enter once closed", () => {
		const { menu, press, type } = setup();
		type("/");
		press("Escape");

		expect(menu().active).toBe(false);
		expect(press("ArrowDown")).toBe(false);
		expect(press("Enter")).toBe(false);
		expect(press("Escape")).toBe(false);
	});

	it("closes when the slash is deleted", () => {
		const { view, menu, type } = setup();
		type("/");
		view.dispatch(view.state.tr.delete(1, 2));

		expect(menu().active).toBe(false);
	});

	it("closes when the caret moves before the slash", () => {
		const { view, menu, type } = setup();
		type("/ta");
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));

		expect(menu().active).toBe(false);
	});
});

describe("asynchronous commands", () => {
	function deferredImages() {
		let resolve: (images: ImageAttrs[]) => void = () => undefined;
		const host: SlashCommandHost = {
			chooseImages: () =>
				new Promise<ImageAttrs[]>((settle) => {
					resolve = settle;
				}),
		};

		return { host, resolve: (images: ImageAttrs[]) => resolve(images) };
	}

	it("shows a pending state until the command resolves, then inserts", async () => {
		const deferred = deferredImages();
		const { view, menu, type } = setup({ host: deferred.host });
		type("/image");

		const running = run(view, "image");
		expect(menu().pending).toBe(true);

		deferred.resolve([{ src: "shot.png", alt: "shot" }]);
		expect(await running).toBe(true);
		expect(menu().active).toBe(false);
		expect(markdownOf(view)).toBe("![shot](shot.png)\n");
	});

	it("ignores typing and editing keys while a command is pending", () => {
		const deferred = deferredImages();
		const { view, press, type } = setup({ host: deferred.host });
		type("/image");
		void run(view, "image");

		type("x");
		expect(press("Backspace")).toBe(true);
		expect(press("Enter")).toBe(true);
		expect(firstBlock(view).textContent).toBe("/image");
	});

	it("inserts nothing when the menu is dismissed before the command resolves", async () => {
		const deferred = deferredImages();
		const { view, press, type } = setup({ host: deferred.host });
		type("/image");
		const running = run(view, "image");

		press("Escape");
		deferred.resolve([{ src: "late.png", alt: "" }]);

		expect(await running).toBe(false);
		expect(firstBlock(view).textContent).toBe("/image");
	});

	it("leaves the typed text when the image dialog is cancelled", async () => {
		const { view, menu, type } = setup();
		type("/image");

		expect(await run(view, "image")).toBe(false);
		expect(menu().active).toBe(false);
		expect(firstBlock(view).textContent).toBe("/image");
	});
});

describe("insertion commands", () => {
	it("lists every insertable block type in an unfiltered menu", () => {
		const { ids, type } = setup();
		type("/");

		expect(ids()).toEqual(expect.arrayContaining(INSERTABLE));
	});

	it("gives every block entry keywords", () => {
		for (const command of slashCommands.list().filter((item) => INSERTABLE.includes(item.id))) {
			expect(command.keywords.length, command.id).toBeGreaterThan(0);
		}
	});

	const EXPECTED_TYPES: Record<string, string> = {
		heading1: "heading",
		heading6: "heading",
		bulletList: "list",
		orderedList: "list",
		taskList: "list",
		blockquote: "blockquote",
		codeBlock: "codeBlock",
		table: "table",
		thematicBreak: "thematicBreak",
	};

	for (const [id, expectedType] of Object.entries(EXPECTED_TYPES)) {
		it(`inserts ${id} in place of the trigger text`, async () => {
			const { view, type } = setup();
			type("/");

			expect(await run(view, id)).toBe(true);
			expect(firstBlock(view).type.name).toBe(expectedType);
			expect(view.state.doc.textContent).not.toContain("/");
		});
	}

	it("makes the task list's item an unchecked task", async () => {
		const { view, type } = setup();
		type("/task");
		await run(view, "taskList");

		expect(firstBlock(view).child(0).attrs.checked).toBe(false);
	});

	it("puts the caret in the new block, so typing fills it", async () => {
		const { view, type } = setup();
		type("/quote");
		await run(view, "blockquote");
		type("cited");

		expect(markdownOf(view)).toBe("> cited\n");
	});

	it("puts the caret in the first header cell of a new table", async () => {
		const { view, type } = setup();
		type("/table");
		await run(view, "table");
		type("Weapon");

		expect(firstBlock(view).child(0).child(0).textContent).toBe("Weapon");
	});

	it("puts the caret after a new horizontal rule", async () => {
		const { view, type } = setup();
		type("/rule");
		await run(view, "thematicBreak");
		type("after");

		expect(view.state.doc.child(1).textContent).toBe("after");
	});

	it("inserts nodes that serialize to stable Markdown", async () => {
		for (const id of Object.keys(EXPECTED_TYPES)) {
			const { view, type } = setup();
			type("/");
			await run(view, id);
			// Content in the new block, as a user would add; a rule's caret
			// paragraph left empty is an editing artifact, not saved content.
			type("x");

			// Saving, reopening and saving again changes nothing: the round-trip holds.
			const saved = markdownOf(view);
			const reopened = createTestView(docFrom(saved));
			expect(markdownOf(reopened), id).toBe(saved);
		}
	});
});

describe("abandonment and undo", () => {
	it("leaves the slash and the filter as typed text on Escape", () => {
		const { view, menu, press, type } = setup();
		type("/hea");

		expect(press("Escape")).toBe(true);
		expect(menu().active).toBe(false);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("/hea");
	});

	it("closes and leaves the typed text when the filter matches nothing", () => {
		const { view, menu, type } = setup();
		type("/zzz");

		expect(menu().active).toBe(false);
		expect(firstBlock(view).textContent).toBe("/zzz");
	});

	it("does not reopen when a no-match filter is edited back to a match", () => {
		const { view, menu, type } = setup();
		type("/tz");
		view.dispatch(view.state.tr.delete(view.state.selection.from - 1, view.state.selection.from));

		expect(firstBlock(view).textContent).toBe("/t");
		expect(menu().active).toBe(false);
	});

	it("returns to the literal trigger text with a single undo", async () => {
		const { view, type } = setup();
		type("/table");
		await run(view, "table");
		expect(firstBlock(view).type.name).toBe("table");

		undo(view.state, view.dispatch);

		expect(view.state.doc.childCount).toBe(1);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("/table");
		expect(slashMenuKey.getState(view.state)?.active).toBe(false);
	});

	it("keeps typing after an insertion in its own undo step", async () => {
		const { view, type } = setup();
		type("/h2");
		await run(view, "heading2");
		type("Title");

		undo(view.state, view.dispatch);
		expect(firstBlock(view).type.name).toBe("heading");
		expect(firstBlock(view).textContent).toBe("");

		undo(view.state, view.dispatch);
		expect(firstBlock(view).type.name).toBe("paragraph");
		expect(firstBlock(view).textContent).toBe("/h2");
	});
});

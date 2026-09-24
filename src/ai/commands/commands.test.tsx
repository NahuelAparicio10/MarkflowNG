import { undo } from "@tiptap/pm/history";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createTestView, docFrom, markdownOf, typeText } from "../../editor/__tests__/harness";
import { createSlashMenuPlugin, runSlashMenuItem, slashMenuKey } from "../../editor/slashMenu/plugin";
import { createSlashCommandRegistry } from "../../editor/slashMenu/registry";
import type { AiSuggestion } from "../../editor/slashMenu/types";
import type { AiProvider } from "../provider/types";
import AiReview from "../Review";
import AiPanel from "../Panel";
import { DEVICE_PROVIDER_SCOPE, useAiSettings } from "../provider/settings";
import { registerAiCommands, replacementTransaction } from ".";

function setup(provider: AiProvider | undefined, accept = true) {
	const registry = createSlashCommandRegistry();
	registerAiCommands(registry, () => provider);
	const review = vi.fn<(suggestion: AiSuggestion) => Promise<boolean>>().mockResolvedValue(accept);
	const plugin = createSlashMenuPlugin(registry, { chooseImages: async () => [], reviewAiSuggestion: review });
	const view = createTestView(docFrom("Original text"), [plugin]);
	view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 14)));
	const before = markdownOf(view);
	plugin.props.handleKeyDown?.call(plugin, view as unknown as EditorView, { code: "Space", ctrlKey: true, shiftKey: true } as KeyboardEvent);
	return { view, review, before, plugin, run: () => runSlashMenuItem(view as unknown as EditorView, 0) };
}

const provider = (text: string): AiProvider => ({ kind: "local", generate: async () => ({ ok: true, text }) });

describe("AI selection commands through the existing menu", () => {
	it("contributes to the existing menu without adding another menu component", () => {
		const editor = readFileSync(new URL("../../editor/EditorView.tsx", import.meta.url), "utf8");
		expect(editor.match(/<SlashMenu\b/g)).toHaveLength(1);
		const registration = readFileSync(new URL("../../editor/slashMenu/index.ts", import.meta.url), "utf8");
		expect(registration).toContain("registerAiCommands(slashCommands,");
		for (const name of readdirSync(new URL("../", import.meta.url))) {
			if (name.endsWith(".tsx")) {
				const source = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
				expect(source).not.toMatch(/role=["'](?:menu|listbox)["']/);
			}
		}
	});

	it("registers all five operations with selection and provider predicates", () => {
		const registry = createSlashCommandRegistry();
		registerAiCommands(registry, () => provider("New"));
		expect(registry.list().map((entry) => entry.id)).toEqual(["ai-rewrite", "ai-summarize", "ai-expand", "ai-table", "ai-list"]);
		const state = EditorState.create({ doc: docFrom("Text") });
		expect(registry.list().every((entry) => !entry.isAvailable(state))).toBe(true);
		const unconfigured = setup(undefined);
		expect(slashMenuKey.getState(unconfigured.view.state)?.items).toHaveLength(0);
	});

	it("uses a device provider for standalone-document selection commands", () => {
		useAiSettings.setState({ providers: new Map([[DEVICE_PROVIDER_SCOPE, provider("Replacement")]]) });
		const registry = createSlashCommandRegistry();
		registerAiCommands(registry, () => useAiSettings.getState().providers.get(DEVICE_PROVIDER_SCOPE));
		const doc = docFrom("Standalone document");
		const state = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 10) });
		expect(registry.list().every((entry) => entry.isAvailable(state))).toBe(true);
		useAiSettings.setState({ providers: new Map() });
	});

	it("explains that workspace Q&A needs a folder while leaving provider settings available", () => {
		useAiSettings.setState({ providers: new Map() });
		const html = renderToStaticMarkup(<AiPanel root={null} onSettings={() => undefined} onOpenWorkspace={() => undefined} />);
		expect(html).toContain("Open a folder to ask questions across a workspace");
		expect(html).toContain("Configure provider");
		expect(html).not.toContain("<textarea");
	});

	it("applies validated heading and list structure and reverses everything in one undo", async () => {
		const { view, before, run, review } = setup(provider("# Heading\n\n- First\n- Second"));
		expect(await run()).toBe(true);
		expect(review).toHaveBeenCalledOnce();
		expect(view.state.doc.child(0).type.name).toBe("heading");
		expect(view.state.doc.child(1).type.name).toBe("list");
		expect(undo(view.state, (tr) => view.dispatch(tr))).toBe(true);
		expect(markdownOf(view)).toBe(before);
	});

	it("keeps a rejected result byte-identical and exposes removals in the rendered review", async () => {
		const { view, before, run, review } = setup(provider("New text"), false);
		expect(await run()).toBe(false);
		expect(markdownOf(view)).toBe(before);
		const html = renderToStaticMarkup(<AiReview suggestion={review.mock.calls[0][0]} onResolve={() => undefined} />);
		expect(html).toContain("<del>Original text");
		expect(html).toContain("<ins>New text</ins>");
	});

	it("uses the same menu's pending state without changing the selection or document", async () => {
		let finish!: (value: { ok: true; text: string }) => void;
		const { view, before, run, plugin } = setup({ kind: "local", generate: () => new Promise((resolve) => { finish = resolve; }) });
		const running = run();
		expect(slashMenuKey.getState(view.state)?.pending).toBe(true);
		typeText(view, "ignored", plugin);
		expect(markdownOf(view)).toBe(before);
		finish({ ok: true, text: "Replacement" });
		await running;
		expect(slashMenuKey.getState(view.state)?.active).toBe(false);
	});

	it("does not apply stale responses after intervening edits", async () => {
		let finish!: (value: { ok: true; text: string }) => void;
		const { view, run, review } = setup({ kind: "local", generate: () => new Promise((resolve) => { finish = resolve; }) });
		const running = run();
		view.dispatch(view.state.tr.insertText("User edit"));
		finish({ ok: true, text: "Outdated" });
		expect(await running).toBe(false);
		expect(review).not.toHaveBeenCalled();
		expect(markdownOf(view)).toContain("User edit");
	});

	it("reports provider failure without changing the document", async () => {
		const { view, before, run, review } = setup({ kind: "local", generate: async () => ({ ok: false, error: { code: "unavailable", message: "Unavailable" } }) });
		expect(await run()).toBe(false);
		expect(markdownOf(view)).toBe(before);
		expect(review.mock.calls[0][0].error).toBe("Unavailable");
	});

	it("rejects invalid schema output without modifying the original state", () => {
		const schema = new Schema({ nodes: { doc: { content: "paragraph+" }, paragraph: { content: "text*" }, text: {} } });
		const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("Original")])]);
		const state = EditorState.create({ doc, selection: TextSelection.create(doc, 1, 9) });
		expect(() => replacementTransaction(state, "# Heading")).toThrow();
		expect(state.doc).toBe(doc);
	});

	it("keeps raw invalid output available and disables acceptance", async () => {
		const { view, before, run, review } = setup(provider("   "));
		expect(await run()).toBe(false);
		expect(markdownOf(view)).toBe(before);
		expect(review.mock.calls[0][0]).toMatchObject({ replacement: "   ", error: expect.any(String) });
	});
});

import { describe, expect, it } from "vitest";
import { activeListKind, insertWarningCallout, setCodeLanguage, setTextBlock, toggleList } from "../formatting";
import { createTestView, docFrom, markdownOf, positionAfter } from "./harness";

describe("formatting toolbar commands", () => {
	it("changes paragraph heading level without duplicating document state", () => {
		const doc = docFrom("Title\n");
		const view = createTestView(doc, [], positionAfter(doc, "Title"));
		expect(setTextBlock("heading", { level: 2 })(view.state, (tr) => view.dispatch(tr))).toBe(true);
		expect(markdownOf(view)).toBe("## Title\n");
	});

	it("creates portable task lists", () => {
		const doc = docFrom("Task\n");
		const view = createTestView(doc, [], positionAfter(doc, "Task"));
		expect(toggleList("task")(view.state, (tr) => view.dispatch(tr))).toBe(true);
		expect(activeListKind(view.state)).toBe("task");
		expect(markdownOf(view)).toBe("- [ ] Task\n");
	});

	it("inserts a warning callout using GitHub-style Markdown", () => {
		const doc = docFrom("Check this\n");
		const view = createTestView(doc, [], positionAfter(doc, "Check"));
		expect(insertWarningCallout(view.state, (tr) => view.dispatch(tr))).toBe(true);
		expect(markdownOf(view)).toBe("> [!WARNING] Check this\n");
	});

	it("keeps existing warning callouts in canonical portable syntax", () => {
		const view = createTestView(docFrom("> [!WARNING]\n> Be careful\n"));
		expect(markdownOf(view)).toBe("> [!WARNING]\n> Be careful\n");
	});

	it("sets the fenced code language", () => {
		const doc = docFrom("```\necho ok\n```\n");
		const view = createTestView(doc, [], positionAfter(doc, "echo"));
		expect(setCodeLanguage("shell")(view.state, (tr) => view.dispatch(tr))).toBe(true);
		expect(markdownOf(view)).toBe("```shell\necho ok\n```\n");
	});
});

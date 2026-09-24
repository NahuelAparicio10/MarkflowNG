import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { openFileAtPath } from "./openFile";
import { useSessionStore } from "./session";
import { openStartupFile } from "./startupFile";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./openFile", () => ({ openFileAtPath: vi.fn(async () => undefined) }));

beforeEach(() => {
	vi.resetAllMocks();
	useSessionStore.setState({ documents: [], activePath: null, error: null });
});

describe("OS-opened Markdown paths", () => {
	it("opens the backend-provided file through the standard load path", async () => {
		vi.mocked(invoke).mockResolvedValue({ path: "C:/notes/opened.md", error: null });
		await openStartupFile();
		expect(invoke).toHaveBeenCalledWith("startup_file");
		expect(openFileAtPath).toHaveBeenCalledWith("C:/notes/opened.md");
	});

	it("displays a missing-file error and keeps the app startup alive", async () => {
		vi.mocked(invoke).mockResolvedValue({ path: null, error: "File not found: C:/gone.md" });
		await expect(openStartupFile()).resolves.toBeUndefined();
		expect(useSessionStore.getState().error).toBe("File not found: C:/gone.md");
		expect(openFileAtPath).not.toHaveBeenCalled();
	});

	it("silently supports a plain browser without the Tauri command bridge", async () => {
		vi.mocked(invoke).mockRejectedValue(new Error("not in Tauri"));
		await expect(openStartupFile()).resolves.toBeUndefined();
	});
});

import { beforeEach, describe, expect, it } from "vitest";
import { hasEditorFsHatchFile, installEditorFsHatch, readFile } from "../../editor/fs";
import { ASSETS_DIRECTORY, writeImageAsset } from "../assets";

const DOCUMENT = "/workspace/docs/guide.md";
const NOW = new Date(2026, 8, 23, 16, 30, 45);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

beforeEach(() => {
	installEditorFsHatch({ [DOCUMENT]: "# Guide\n" });
});

describe("writing pasted image data", () => {
	it("writes into the assets directory beside the document and returns a relative reference", async () => {
		const asset = await writeImageAsset(DOCUMENT, PNG, "image/png", undefined, NOW);

		expect(asset.reference).toBe(`${ASSETS_DIRECTORY}/image-20260923-163045.png`);
		expect(asset.path).toBe("/workspace/docs/assets/image-20260923-163045.png");
		expect(await readFile(asset.path)).toEqual(PNG);
	});

	it("never overwrites an existing file", async () => {
		const first = await writeImageAsset(DOCUMENT, PNG, "image/png", undefined, NOW);
		const second = await writeImageAsset(DOCUMENT, new Uint8Array([1]), "image/png", undefined, NOW);

		expect(second.reference).toBe("assets/image-20260923-163045-2.png");
		expect(await readFile(first.path)).toEqual(PNG);
		expect(hasEditorFsHatchFile(second.path)).toBe(true);
	});

	it("takes the extension from the file name, then the MIME type", async () => {
		expect((await writeImageAsset(DOCUMENT, PNG, "image/jpeg", "shot.webp", NOW)).reference).toMatch(/\.webp$/);
		expect((await writeImageAsset(DOCUMENT, PNG, "image/jpeg", undefined, NOW)).reference).toMatch(/\.jpg$/);
	});
});

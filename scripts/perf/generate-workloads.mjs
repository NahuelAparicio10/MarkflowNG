/* global process, Buffer, console */
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const destination = resolve(process.argv[2] ?? join(tmpdir(), "markflow-perf-workloads"));
const documentBlocks = Number(process.env.MARKFLOW_PERF_BLOCKS ?? 10_000);
const workspaceFiles = Number(process.env.MARKFLOW_PERF_FILES ?? 5_000);
const documentPath = join(destination, "document", "large-document.md");
const workspaceRoot = join(destination, "workspace");

await mkdir(join(destination, "document"), { recursive: true });
await mkdir(workspaceRoot, { recursive: true });

const blocks = Array.from({ length: documentBlocks }, (_, index) => {
	const number = String(index + 1).padStart(5, "0");
	return index % 20 === 0
		? `## Section ${number}\n\nParagraph ${number}: deterministic performance fixture with representative prose for Markflow parsing and rendering.\n`
		: `Paragraph ${number}: deterministic performance fixture with representative prose for Markflow parsing and rendering.\n`;
});
const markdown = `# Markflow performance fixture\n\n${blocks.join("\n")}`;
await writeFile(documentPath, markdown, "utf8");

const concurrent = 64;
for (let start = 0; start < workspaceFiles; start += concurrent) {
	const batch = Array.from({ length: Math.min(concurrent, workspaceFiles - start) }, async (_, offset) => {
		const index = start + offset;
		const group = String(Math.floor(index / 50)).padStart(4, "0");
		const name = String(index).padStart(5, "0");
		const path = join(workspaceRoot, `group-${group}`, `document-${name}.md`);
		await mkdir(join(workspaceRoot, `group-${group}`), { recursive: true });
		await writeFile(path, `# Document ${name}\n\nWorkspace performance fixture ${name}.\n`, "utf8");
	});
	await Promise.all(batch);
}

const manifest = {
	generator: "scripts/perf/generate-workloads.mjs",
	documentBlocks,
	documentBytes: Buffer.byteLength(markdown),
	documentPath,
	workspaceMarkdownFiles: workspaceFiles,
	workspaceDirectories: Math.ceil(workspaceFiles / 50),
	workspaceRoot,
};
await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest, null, 2));

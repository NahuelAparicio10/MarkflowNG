import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const coreDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** UI layers `src/core/` must never reach into. */
const FORBIDDEN_IMPORTS = [
	"react",
	"react-dom",
	"react/jsx-runtime",
	"@tiptap/react",
	"@tiptap/starter-kit",
	"zustand",
	"@tauri-apps/api",
];

const FORBIDDEN_PATHS = ["/ui/", "/editor/", "/reader/", "/explorer/", "/store/", "/ai/"];

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);

		if (statSync(full).isDirectory()) {
			return sourceFiles(full);
		}

		return [".ts", ".tsx"].includes(extname(full)) ? [full] : [];
	});
}

function importSpecifiers(source: string): string[] {
	const pattern = /(?:from|import)\s*["']([^"']+)["']/g;

	return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe("core is UI-independent", () => {
	// This is the invariant that keeps src/core/ testable in isolation and makes
	// a future migration to Rust an operation with a known boundary.
	const files = sourceFiles(coreDir).filter((file) => !file.includes("__tests__"));

	it("finds core source files to check", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files.map((file) => [file.slice(coreDir.length + 1), file] as const))(
		"%s imports no UI dependency",
		(_name, file) => {
			const specifiers = importSpecifiers(readFileSync(file, "utf8"));

			for (const specifier of specifiers) {
				expect(FORBIDDEN_IMPORTS).not.toContain(specifier);

				const normalized = specifier.split("\\").join("/");
				for (const forbidden of FORBIDDEN_PATHS) {
					expect(normalized).not.toContain(forbidden);
				}
			}
		},
	);
});

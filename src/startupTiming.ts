import { invoke } from "@tauri-apps/api/core";

export interface StartupMark {
	name: string;
	milliseconds: number;
}

const started = performance.now();
const marks: StartupMark[] = [{ name: "webview-module", milliseconds: 0 }];

declare global {
	interface Window { __MARKFLOW_STARTUP_TIMINGS__?: StartupMark[]; }
}

export function markStartup(name: string): void {
	if (marks.some((mark) => mark.name === name)) return;
	marks.push({ name, milliseconds: Number((performance.now() - started).toFixed(2)) });
	const latest = marks[marks.length - 1];
	void invoke("record_startup_mark", { name: latest.name, milliseconds: latest.milliseconds }).catch(() => undefined);
	if (typeof window !== "undefined") window.__MARKFLOW_STARTUP_TIMINGS__ = [...marks];
}

export async function includeBackendStartupTiming(): Promise<void> {
	try {
		const backend = await invoke<{ backendReadyMs: number }>("startup_timing");
		marks.unshift({ name: "backend-ready", milliseconds: backend.backendReadyMs });
		if (typeof window !== "undefined") window.__MARKFLOW_STARTUP_TIMINGS__ = [...marks];
	} catch {
		// Browser development has no backend. Timings always stay local.
	}
}
